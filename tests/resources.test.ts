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

describe("VCRClient.listDepartments", () => {
  it("GETs /departments and parses tax regime + localized title", async () => {
    const fetchMock = makeFetchMock({
      body: [
        {
          internalId: 1,
          externalId: "dept-groceries",
          taxRegime: "vat",
          title: {
            hy: { id: 100, language: "hy", content: "Մթերք" },
            ru: { id: 101, language: "ru", content: "Продукты" },
            en: { id: 102, language: "en", content: "Groceries" },
          },
        },
        {
          internalId: 2,
          externalId: null,
          taxRegime: "turnover_tax",
          title: {
            hy: { id: 103, language: "hy", content: "Ծառայություն" },
          },
        },
      ],
    });
    const client = new VCRClient("k", { fetch: fetchMock });

    const result = await client.listDepartments();

    expect(result).toHaveLength(2);
    expect(result[0]?.internalId).toBe(1);
    expect(result[0]?.externalId).toBe("dept-groceries");
    expect(result[0]?.taxRegime).toBe("vat");
    expect(result[0]?.title["hy"]?.content).toBe("Մթերք");
    expect(result[1]?.externalId).toBeNull();
    expect(result[1]?.taxRegime).toBe("turnover_tax");

    expect(fetchMock.calls[0]?.method).toBe("GET");
    expect(fetchMock.calls[0]?.url).toBe(`${DEFAULT_API_URL}/departments`);
  });

  it("accepts an empty list", async () => {
    const fetchMock = makeFetchMock({ body: [] });
    const client = new VCRClient("k", { fetch: fetchMock });
    const result = await client.listDepartments();
    expect(result).toEqual([]);
  });
});

describe("VCRClient.createDepartment", () => {
  it("POSTs to /departments with taxRegime and title", async () => {
    const fetchMock = makeFetchMock({
      status: 201,
      body: { message: "New department have been created", department: 3 },
    });
    const client = new VCRClient("k", { fetch: fetchMock });

    const result = await client.createDepartment({
      taxRegime: "vat",
      title: {
        value: { hy: "Մթերք", ru: "Продукты", en: "Groceries" },
        localizationStrategy: "translation",
      },
    });

    expect(result.department).toBe(3);
    const call = fetchMock.calls[0];
    expect(call?.url).toBe(`${DEFAULT_API_URL}/departments`);
    const sentBody = JSON.parse(call?.body ?? "{}");
    expect(sentBody.taxRegime).toBe("vat");
    expect(sentBody.title).toEqual({
      value: { hy: "Մթերք", ru: "Продукты", en: "Groceries" },
      localizationStrategy: "translation",
    });
  });

  it("propagates 502 SRC failures as VCRApiError", async () => {
    const fetchMock = makeFetchMock({
      status: 502,
      body: {
        error: "Create department request failed. RA State Revenue Committee returned an error.",
      },
    });
    const client = new VCRClient("k", { fetch: fetchMock });

    const error = await client
      .createDepartment({
        taxRegime: "vat",
        title: {
          value: { hy: "Մթերք" },
          localizationStrategy: "transliteration",
        },
      })
      .catch((e) => e);

    expect(error.kind).toBe("api");
    expect(error.status).toBe(502);
  });
});
