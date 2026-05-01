import { describe, expect, it } from "vitest";

import { DEFAULT_API_URL, VCRClient } from "../src";

import { makeFetchMock, VALID_SALE, VALID_SALE_RESPONSE } from "./helpers";

const SALE_DETAIL = {
  id: 42,
  createdAt: "2026-04-15T12:34:56.789Z",
  buyerTin: null,
  cashAmount: 1000,
  nonCashAmount: 0,
  prepaymentAmount: 0,
  compensationAmount: 0,
  receipt: {
    srcId: 9876,
    time: "1715000000000",
    tin: "12345678",
    fiscal: "F123",
    sn: "SN1",
    address: null,
    total: 1000,
    taxpayer: "Test LLC",
    change: 0,
  },
  refunds: [],
  cashier: {
    internalId: 1,
    deskId: "12345678901234567890ab",
    name: [
      {
        id: 1,
        language: "hy" as const,
        content: "Անուն",
      },
    ],
  },
  items: [
    {
      srcId: 1,
      quantity: 1,
      price: 1000,
      unit: "pc" as const,
      discount: null,
      discountType: null,
      additionalDiscount: null,
      additionalDiscountType: null,
      department: {
        internalId: 1,
        taxRegime: "vat" as const,
        title: [{ id: 2, language: "hy" as const, content: "Բաժին" }],
      },
      offer: {
        type: "product" as const,
        classifierCode: "12345678",
        title: [{ id: 3, language: "hy" as const, content: "Ապրանք" }],
      },
    },
  ],
};

describe("VCRClient.getSale", () => {
  it("GETs /sales/{id} with the correct path", async () => {
    const fetchMock = makeFetchMock({ body: SALE_DETAIL });
    const client = new VCRClient("k", { fetch: fetchMock });

    const result = await client.getSale(42);

    expect(result.id).toBe(42);
    expect(result.cashier.internalId).toBe(1);
    expect(result.items).toHaveLength(1);

    const call = fetchMock.calls[0];
    expect(call?.method).toBe("GET");
    expect(call?.url).toBe(`${DEFAULT_API_URL}/sales/42`);
    expect(call?.body).toBeUndefined();
  });

  it("rejects negative ids before making a request", async () => {
    const fetchMock = makeFetchMock({ body: SALE_DETAIL });
    const client = new VCRClient("k", { fetch: fetchMock });

    expect(() => client.getSale(-1)).toThrow(/non-negative integer/);
    expect(fetchMock.calls).toHaveLength(0);
  });

  it("rejects fractional ids before making a request", async () => {
    const fetchMock = makeFetchMock({ body: SALE_DETAIL });
    const client = new VCRClient("k", { fetch: fetchMock });

    expect(() => client.getSale(1.5)).toThrow(/non-negative integer/);
  });
});

describe("VCRClient.registerSaleRefund", () => {
  it("POSTs to /sales/refund with refundAmounts and items", async () => {
    const fetchMock = makeFetchMock({
      body: {
        urlId: "abc",
        saleRefundId: 7,
        crn: "CRN-7",
        receiptId: 9999,
        fiscal: "F-7",
      },
    });
    const client = new VCRClient("k", { fetch: fetchMock });

    const result = await client.registerSaleRefund({
      cashier: { id: 1 },
      saleId: 42,
      reason: "customer_request",
      refundAmounts: { cash: "1000" },
      items: [{ srcId: 1, quantity: "1" }],
    });

    expect(result.saleRefundId).toBe(7);
    expect(result.crn).toBe("CRN-7");

    const call = fetchMock.calls[0];
    expect(call?.method).toBe("POST");
    expect(call?.url).toBe(`${DEFAULT_API_URL}/sales/refund`);
    const sentBody = JSON.parse(call?.body ?? "{}");
    expect(sentBody.saleId).toBe(42);
    expect(sentBody.reason).toBe("customer_request");
  });

  it("accepts a nullable crn/fiscal in the response", async () => {
    const fetchMock = makeFetchMock({
      body: {
        urlId: "abc",
        saleRefundId: 7,
        crn: null,
        receiptId: 9999,
        fiscal: null,
      },
    });
    const client = new VCRClient("k", { fetch: fetchMock });

    const result = await client.registerSaleRefund({
      cashier: { id: 1 },
      saleId: 42,
    });

    expect(result.crn).toBeNull();
    expect(result.fiscal).toBeNull();
  });
});

describe("VCRClient.registerSale (regression)", () => {
  it("uses lowercase 'prepayment' on the wire (was 'prePayment' bug in 0.8.0)", async () => {
    const fetchMock = makeFetchMock({ body: VALID_SALE_RESPONSE });
    const client = new VCRClient("k", { fetch: fetchMock });

    await client.registerSale({
      ...VALID_SALE,
      amount: { prepayment: "500", cash: "500" },
    });

    const sent = JSON.parse(fetchMock.calls[0]?.body ?? "{}");
    expect(sent.amount.prepayment).toBe("500");
    expect(sent.amount.prePayment).toBeUndefined();
  });
});
