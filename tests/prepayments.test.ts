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
  remaining: 500,
  state: "open" as const,
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

describe("VCRClient.listPrepayments", () => {
  it("GETs /prepayments without query when no filter is given", async () => {
    const fetchMock = makeFetchMock({ body: [] });
    const client = new VCRClient("k", { fetch: fetchMock });

    const result = await client.listPrepayments();

    expect(result).toEqual([]);
    expect(fetchMock.calls[0]?.url).toBe(`${DEFAULT_API_URL}/prepayments`);
  });

  it("appends customerRef + state to the query when provided", async () => {
    const fetchMock = makeFetchMock({
      body: [
        {
          id: 11,
          createdAt: "2026-04-15T12:34:56.789Z",
          buyerTin: "01234567",
          cashAmount: 1000,
          nonCashAmount: 0,
          remaining: 600,
          state: "open",
        },
      ],
    });
    const client = new VCRClient("k", { fetch: fetchMock });

    const result = await client.listPrepayments({
      customerRef: "01234567",
      state: "open",
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.state).toBe("open");
    expect(result[0]?.remaining).toBe(600);

    const call = fetchMock.calls[0];
    const url = new URL(call?.url ?? "");
    expect(url.pathname.endsWith("/prepayments")).toBe(true);
    expect(url.searchParams.get("customerRef")).toBe("01234567");
    expect(url.searchParams.get("state")).toBe("open");
  });
});

describe("VCRClient.getCustomerPrepaymentBalance", () => {
  it("GETs /prepayments/balance with customerRef", async () => {
    const fetchMock = makeFetchMock({
      body: {
        entityId: 42,
        customerRef: "01234567",
        balance: 1500,
        openPrepayments: [
          {
            prepaymentId: 11,
            createdAt: "2026-04-15T12:34:56.789Z",
            cashAmount: 1000,
            nonCashAmount: 0,
            buyerTin: "01234567",
            remaining: 600,
          },
          {
            prepaymentId: 12,
            createdAt: "2026-04-16T08:00:00.000Z",
            cashAmount: 0,
            nonCashAmount: 900,
            buyerTin: "01234567",
            remaining: 900,
          },
        ],
      },
    });
    const client = new VCRClient("k", { fetch: fetchMock });

    const result = await client.getCustomerPrepaymentBalance({
      customerRef: "01234567",
    });

    expect(result.balance).toBe(1500);
    expect(result.openPrepayments).toHaveLength(2);
    expect(result.openPrepayments[0]?.prepaymentId).toBe(11);

    const url = new URL(fetchMock.calls[0]?.url ?? "");
    expect(url.pathname.endsWith("/prepayments/balance")).toBe(true);
    expect(url.searchParams.get("customerRef")).toBe("01234567");
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
