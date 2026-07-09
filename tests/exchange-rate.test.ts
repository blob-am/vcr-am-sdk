import { describe, expect, it } from "vitest";

import { DEFAULT_API_URL, VCRClient } from "../src";

import { makeFetchMock } from "./helpers";

describe("VCRClient.getExchangeRate", () => {
  it("GETs /exchange-rate with the currency query and parses the rate", async () => {
    const fetchMock = makeFetchMock({
      body: {
        currency: "RUB",
        ratePerUnit: 4.32,
        amount: 1,
        rateDate: "2026-07-08",
        saleDate: "2026-07-09",
        ruleVersion: "HO-234-N",
        source: "CBA",
      },
    });
    const client = new VCRClient("k", { fetch: fetchMock });

    const rate = await client.getExchangeRate({ currency: "rub" });

    expect(rate.currency).toBe("RUB");
    expect(rate.ratePerUnit).toBe(4.32);
    expect(rate.source).toBe("CBA");

    const call = fetchMock.calls[0];
    expect(call?.method).toBe("GET");
    expect(call?.url).toBe(`${DEFAULT_API_URL}/exchange-rate?currency=rub`);
    expect(call?.body).toBeUndefined();
  });
});
