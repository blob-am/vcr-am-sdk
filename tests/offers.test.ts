import { describe, expect, it } from "vitest";

import { DEFAULT_API_URL, VCRClient } from "../src";

import { makeFetchMock } from "./helpers";

const OFFER_ITEM = {
  id: 99,
  externalId: "sku-coffee",
  type: "product" as const,
  classifierCode: "0901",
  defaultMeasureUnit: "pc",
  defaultDepartment: { internalId: 1 },
  title: [{ id: 3, language: "hy" as const, content: "Սուրճ" }],
  archivedAt: null,
  createdAt: "2026-05-01T10:00:00.000Z",
};

describe("VCRClient.listOffers", () => {
  it("GETs /offers with no query when no filter is given", async () => {
    const fetchMock = makeFetchMock({ body: [OFFER_ITEM] });
    const client = new VCRClient("k", { fetch: fetchMock });

    const result = await client.listOffers();

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(99);
    expect(result[0]?.externalId).toBe("sku-coffee");
    expect(result[0]?.title[0]?.content).toBe("Սուրճ");
    expect(fetchMock.calls[0]?.method).toBe("GET");
    expect(fetchMock.calls[0]?.url).toBe(`${DEFAULT_API_URL}/offers`);
  });

  it("encodes externalId, type, and includeArchived into the query", async () => {
    const fetchMock = makeFetchMock({ body: [] });
    const client = new VCRClient("k", { fetch: fetchMock });

    await client.listOffers({ externalId: "sku-coffee", type: "service", includeArchived: true });

    const url = new URL(fetchMock.calls[0]?.url ?? "");
    expect(url.searchParams.get("externalId")).toBe("sku-coffee");
    expect(url.searchParams.get("type")).toBe("service");
    expect(url.searchParams.get("includeArchived")).toBe("true");
  });

  it("serializes includeArchived:false explicitly", async () => {
    const fetchMock = makeFetchMock({ body: [] });
    const client = new VCRClient("k", { fetch: fetchMock });

    await client.listOffers({ includeArchived: false });

    const url = new URL(fetchMock.calls[0]?.url ?? "");
    expect(url.searchParams.get("includeArchived")).toBe("false");
  });

  it("accepts a nullable externalId and archivedAt in the response", async () => {
    const fetchMock = makeFetchMock({
      body: [
        {
          ...OFFER_ITEM,
          externalId: null,
          archivedAt: "2026-06-01T00:00:00.000Z",
        },
      ],
    });
    const client = new VCRClient("k", { fetch: fetchMock });

    const result = await client.listOffers({ includeArchived: true });

    expect(result[0]?.externalId).toBeNull();
    expect(result[0]?.archivedAt).toBe("2026-06-01T00:00:00.000Z");
  });
});

describe("VCRClient.getOffer", () => {
  it("GETs /offers/{id}", async () => {
    const fetchMock = makeFetchMock({ body: OFFER_ITEM });
    const client = new VCRClient("k", { fetch: fetchMock });

    const result = await client.getOffer(99);

    expect(result.id).toBe(99);
    expect(fetchMock.calls[0]?.method).toBe("GET");
    expect(fetchMock.calls[0]?.url).toBe(`${DEFAULT_API_URL}/offers/99`);
  });

  it("rejects negative ids before making a request", async () => {
    const fetchMock = makeFetchMock({ body: OFFER_ITEM });
    const client = new VCRClient("k", { fetch: fetchMock });

    expect(() => client.getOffer(-1)).toThrow(/non-negative integer/);
    expect(fetchMock.calls).toHaveLength(0);
  });
});

describe("VCRClient.updateOffer", () => {
  it("PATCHes /offers/{id} with the new canonical title", async () => {
    const fetchMock = makeFetchMock({
      body: { ...OFFER_ITEM, title: [{ id: 4, language: "hy" as const, content: "Կաթ" }] },
    });
    const client = new VCRClient("k", { fetch: fetchMock });

    const result = await client.updateOffer(99, {
      title: {
        type: "localized",
        content: { hy: "Կաթ" },
        localizationStrategy: "transliteration",
      },
    });

    expect(result.title[0]?.content).toBe("Կաթ");

    const call = fetchMock.calls[0];
    expect(call?.method).toBe("PATCH");
    expect(call?.url).toBe(`${DEFAULT_API_URL}/offers/99`);
    const sentBody = JSON.parse(call?.body ?? "{}");
    expect(sentBody.title.type).toBe("localized");
    expect(sentBody.title.content.hy).toBe("Կաթ");
  });

  it("accepts a universal (brand-name) title", async () => {
    const fetchMock = makeFetchMock({ body: OFFER_ITEM });
    const client = new VCRClient("k", { fetch: fetchMock });

    await client.updateOffer(99, {
      title: { type: "universal", content: "Coca-Cola" },
    });

    const sentBody = JSON.parse(fetchMock.calls[0]?.body ?? "{}");
    expect(sentBody.title).toEqual({ type: "universal", content: "Coca-Cola" });
  });

  it("rejects negative ids before making a request", async () => {
    const fetchMock = makeFetchMock({ body: OFFER_ITEM });
    const client = new VCRClient("k", { fetch: fetchMock });

    expect(() => client.updateOffer(-1, { title: { type: "universal", content: "x" } })).toThrow(
      /non-negative integer/,
    );
    expect(fetchMock.calls).toHaveLength(0);
  });
});
