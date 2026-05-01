import { describe, expect, it } from "vitest";

import { DEFAULT_API_URL, VCRClient } from "../src";

import { makeFetchMock } from "./helpers";

describe("VCRClient.listCashiers", () => {
  it("GETs /cashiers and parses the localized name map", async () => {
    const fetchMock = makeFetchMock({
      body: [
        {
          deskId: "12345678901234567890ab",
          internalId: 1,
          name: {
            "1": { language: "hy", content: "Անուն" },
            "2": { language: "en", content: "Name" },
          },
        },
      ],
    });
    const client = new VCRClient("k", { fetch: fetchMock });

    const result = await client.listCashiers();

    expect(result).toHaveLength(1);
    expect(result[0]?.deskId).toBe("12345678901234567890ab");
    expect(result[0]?.name["1"]?.language).toBe("hy");

    expect(fetchMock.calls[0]?.method).toBe("GET");
    expect(fetchMock.calls[0]?.url).toBe(`${DEFAULT_API_URL}/cashiers`);
  });

  it("accepts an empty list", async () => {
    const fetchMock = makeFetchMock({ body: [] });
    const client = new VCRClient("k", { fetch: fetchMock });
    const result = await client.listCashiers();
    expect(result).toEqual([]);
  });
});

describe("VCRClient.createCashier", () => {
  it("POSTs to /cashiers with name + password", async () => {
    const fetchMock = makeFetchMock({
      status: 201,
      body: { id: 1, deskId: "12345678901234567890ab" },
    });
    const client = new VCRClient("k", { fetch: fetchMock });

    const result = await client.createCashier({
      name: {
        value: { hy: "Անուն" },
        localizationStrategy: "translation",
      },
      password: "1234",
    });

    expect(result.id).toBe(1);
    expect(result.deskId).toHaveLength(22);

    const call = fetchMock.calls[0];
    expect(call?.method).toBe("POST");
    expect(call?.url).toBe(`${DEFAULT_API_URL}/cashiers`);
    const sentBody = JSON.parse(call?.body ?? "{}");
    expect(sentBody.password).toBe("1234");
    expect(sentBody.name.value.hy).toBe("Անուն");
  });
});

describe("VCRClient.createOffer", () => {
  it("POSTs to /offers and returns offerId", async () => {
    const fetchMock = makeFetchMock({
      status: 201,
      body: { offerId: 99 },
    });
    const client = new VCRClient("k", { fetch: fetchMock });

    const result = await client.createOffer({
      type: "product",
      classifierCode: "12345678",
      title: {
        value: { hy: "Կաթ" },
        localizationStrategy: "transliteration",
      },
      defaultMeasureUnit: "l",
      defaultDepartment: { id: 1 },
    });

    expect(result.offerId).toBe(99);
    expect(fetchMock.calls[0]?.url).toBe(`${DEFAULT_API_URL}/offers`);
  });
});

describe("VCRClient.createDepartment", () => {
  it("POSTs to /departments with taxRegime", async () => {
    const fetchMock = makeFetchMock({
      status: 201,
      body: { message: "New department have been created", department: 3 },
    });
    const client = new VCRClient("k", { fetch: fetchMock });

    const result = await client.createDepartment({ taxRegime: "vat" });

    expect(result.department).toBe(3);
    const call = fetchMock.calls[0];
    expect(call?.url).toBe(`${DEFAULT_API_URL}/departments`);
    const sentBody = JSON.parse(call?.body ?? "{}");
    expect(sentBody.taxRegime).toBe("vat");
  });

  it("propagates 502 SRC failures as VCRApiError", async () => {
    const fetchMock = makeFetchMock({
      status: 502,
      body: {
        error: "Create department request failed. RA State Revenue Committee returned an error.",
      },
    });
    const client = new VCRClient("k", { fetch: fetchMock });

    const error = await client.createDepartment({ taxRegime: "vat" }).catch((e) => e);

    expect(error.kind).toBe("api");
    expect(error.status).toBe(502);
  });
});
