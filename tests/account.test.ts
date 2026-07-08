import { describe, expect, it } from "vitest";

import { DEFAULT_API_URL, VCRClient } from "../src";

import { makeFetchMock } from "./helpers";

describe("VCRClient.whoami", () => {
  it("GETs /whoami and parses the identity", async () => {
    const fetchMock = makeFetchMock({
      body: {
        vcrId: 7,
        crn: "12345678901",
        mode: "production",
        tradingPlatformName: "My Shop",
        businessEntity: { tin: "12345678", name: "My LLC" },
      },
    });
    const client = new VCRClient("k", { fetch: fetchMock });

    const result = await client.whoami();

    expect(result.vcrId).toBe(7);
    expect(result.mode).toBe("production");
    expect(result.businessEntity.tin).toBe("12345678");

    expect(fetchMock.calls[0]?.method).toBe("GET");
    expect(fetchMock.calls[0]?.url).toBe(`${DEFAULT_API_URL}/whoami`);
  });

  it("accepts a null crn for an unactivated / sandbox VCR", async () => {
    const fetchMock = makeFetchMock({
      body: {
        vcrId: 8,
        crn: null,
        mode: "sandbox",
        tradingPlatformName: "Sandbox",
        businessEntity: { tin: "87654321", name: "Sandbox LLC" },
      },
    });
    const client = new VCRClient("k", { fetch: fetchMock });

    const result = await client.whoami();

    expect(result.crn).toBeNull();
    expect(result.mode).toBe("sandbox");
  });
});
