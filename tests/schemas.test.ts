import { describe, expect, it } from "vitest";

import {
  classifierSearchItemSchema,
  classifierSearchResponseSchema,
  registerSaleResponseSchema,
  saleDetailResponseSchema,
} from "../src/schemas";

describe("registerSaleResponseSchema", () => {
  it("accepts a valid response", () => {
    const result = registerSaleResponseSchema.safeParse({
      urlId: "abc",
      saleId: 1,
      crn: "C",
      srcReceiptId: 2,
      fiscal: "F",
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative saleId", () => {
    const result = registerSaleResponseSchema.safeParse({
      urlId: "abc",
      saleId: -1,
      crn: "C",
      srcReceiptId: 0,
      fiscal: "F",
    });
    expect(result.success).toBe(false);
  });

  it("rejects fractional srcReceiptId", () => {
    const result = registerSaleResponseSchema.safeParse({
      urlId: "abc",
      saleId: 1,
      crn: "C",
      srcReceiptId: 1.5,
      fiscal: "F",
    });
    expect(result.success).toBe(false);
  });
});

describe("classifierSearchResponseSchema", () => {
  it("accepts an empty array", () => {
    const result = classifierSearchResponseSchema.safeParse([]);
    expect(result.success).toBe(true);
  });

  it("accepts an item without a title (optional per server contract)", () => {
    const result = classifierSearchItemSchema.safeParse({ code: "1" });
    expect(result.success).toBe(true);
  });

  it("rejects items missing the required code field", () => {
    const result = classifierSearchItemSchema.safeParse({ title: "x" });
    expect(result.success).toBe(false);
  });
});

describe("saleDetailResponseSchema (localization)", () => {
  // Regression: Prisma's Language enum includes "multi"; rejecting it would
  // make getSale/getPrepayment fail on cross-language localization rows.
  const baseDetail = {
    id: 1,
    createdAt: "2026-04-15T12:34:56.789Z",
    buyerTin: null,
    cashAmount: 0,
    nonCashAmount: 0,
    prepaymentAmount: 0,
    compensationAmount: 0,
    receipt: null,
    refunds: [],
    items: [],
  };

  it("accepts cashier names with language 'multi'", () => {
    const result = saleDetailResponseSchema.safeParse({
      ...baseDetail,
      cashier: {
        internalId: 1,
        deskId: "12345678901234567890ab",
        name: [{ id: 1, language: "multi", content: "Universal" }],
      },
    });
    expect(result.success).toBe(true);
  });
});
