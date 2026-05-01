import { describe, expect, it } from "vitest";

import { DEFAULT_API_URL, VCRClient } from "../src";

import { makeFetchMock } from "./helpers";

const PREPAYMENT_DETAIL = {
  id: 7,
  createdAt: "2026-04-15T12:34:56.789Z",
  buyerTin: null,
  cashAmount: 500,
  nonCashAmount: 0,
  receipt: null,
  refund: null,
  cashier: {
    internalId: 1,
    deskId: "12345678901234567890ab",
    name: [{ id: 1, language: "hy" as const, content: "Անուն" }],
  },
};

describe("VCRClient.registerPrepayment", () => {
  it("POSTs to /prepayments with cashier + amount + buyer", async () => {
    const fetchMock = makeFetchMock({
      body: {
        urlId: "abc",
        prepaymentId: 7,
        crn: "C-7",
        receiptId: 100,
        fiscal: "F-7",
      },
    });
    const client = new VCRClient("k", { fetch: fetchMock });

    const result = await client.registerPrepayment({
      cashier: { id: 1 },
      amount: { cash: "500" },
      buyer: { type: "individual" },
    });

    expect(result.prepaymentId).toBe(7);

    const call = fetchMock.calls[0];
    expect(call?.method).toBe("POST");
    expect(call?.url).toBe(`${DEFAULT_API_URL}/prepayments`);
    const sentBody = JSON.parse(call?.body ?? "{}");
    expect(sentBody.amount.cash).toBe("500");
  });
});

describe("VCRClient.getPrepayment", () => {
  it("GETs /prepayments/{id}", async () => {
    const fetchMock = makeFetchMock({ body: PREPAYMENT_DETAIL });
    const client = new VCRClient("k", { fetch: fetchMock });

    const result = await client.getPrepayment(7);

    expect(result.id).toBe(7);
    expect(result.cashier.internalId).toBe(1);
    expect(fetchMock.calls[0]?.url).toBe(`${DEFAULT_API_URL}/prepayments/7`);
  });

  it("rejects non-integer ids", async () => {
    const fetchMock = makeFetchMock({ body: PREPAYMENT_DETAIL });
    const client = new VCRClient("k", { fetch: fetchMock });
    expect(() => client.getPrepayment(7.5)).toThrow(/non-negative integer/);
  });
});

describe("VCRClient.registerPrepaymentRefund", () => {
  it("POSTs to /prepayments/refund with reason and reasonNote", async () => {
    const fetchMock = makeFetchMock({
      body: {
        urlId: "abc",
        prepaymentRefundId: 33,
        crn: null,
        receiptId: 200,
        fiscal: null,
      },
    });
    const client = new VCRClient("k", { fetch: fetchMock });

    const result = await client.registerPrepaymentRefund({
      cashier: { id: 1 },
      prepaymentId: 7,
      reason: "other",
      reasonNote: "Wrong amount entered",
    });

    expect(result.prepaymentRefundId).toBe(33);
    expect(result.crn).toBeNull();

    const call = fetchMock.calls[0];
    expect(call?.url).toBe(`${DEFAULT_API_URL}/prepayments/refund`);
    const sentBody = JSON.parse(call?.body ?? "{}");
    expect(sentBody.reason).toBe("other");
    expect(sentBody.reasonNote).toBe("Wrong amount entered");
  });
});
