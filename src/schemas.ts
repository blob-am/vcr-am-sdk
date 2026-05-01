import { z } from "zod";

import { AVAILABLE_LANGUAGES, TAX_REGIMES, unitsKeys } from "./constants";

export const apiErrorBodySchema = z.object({
  error: z.string(),
  issues: z
    .array(
      z.object({
        path: z.array(z.union([z.string(), z.number()])),
        message: z.string(),
        code: z.string(),
      }),
    )
    .optional(),
});

const isoDateTimeSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, "Invalid ISO datetime");

// Detail responses use Prisma's `Language` enum, which is wider than
// AVAILABLE_LANGUAGES — it also includes "multi" for cross-language content.
const detailLanguageSchema = z.enum([...AVAILABLE_LANGUAGES, "multi"]);

const localizationEntrySchema = z.object({
  id: z.number().int(),
  language: detailLanguageSchema,
  content: z.string(),
});

const offerTypeSchema = z.enum(["product", "service"]);
const unitSchema = z.enum(unitsKeys);
const taxRegimeSchema = z.enum(TAX_REGIMES);
const discountTypeSchema = z.enum(["percent", "price", "total"]).nullable();
const additionalDiscountTypeSchema = z.enum(["percent", "total"]).nullable();

// ─── Action responses ────────────────────────────────────────────────────────

export const registerSaleResponseSchema = z.object({
  urlId: z.string(),
  saleId: z.number().int().nonnegative(),
  crn: z.string(),
  srcReceiptId: z.number().int().nonnegative(),
  fiscal: z.string(),
});

export const registerSaleRefundResponseSchema = z.object({
  urlId: z.string(),
  saleRefundId: z.number().int().nonnegative(),
  crn: z.string().nullable(),
  receiptId: z.number().int().nonnegative(),
  fiscal: z.string().nullable(),
});

export const registerPrepaymentResponseSchema = z.object({
  urlId: z.string(),
  prepaymentId: z.number().int().nonnegative(),
  crn: z.string().nullable(),
  receiptId: z.number().int().nonnegative(),
  fiscal: z.string().nullable(),
});

export const registerPrepaymentRefundResponseSchema = z.object({
  urlId: z.string(),
  prepaymentRefundId: z.number().int().nonnegative(),
  crn: z.string().nullable(),
  receiptId: z.number().int().nonnegative(),
  fiscal: z.string().nullable(),
});

export const createOfferResponseSchema = z.object({
  offerId: z.number().int().nonnegative(),
});

export const createCashierResponseSchema = z.object({
  id: z.number().int().nonnegative(),
  deskId: z.string(),
});

export const createDepartmentResponseSchema = z.object({
  message: z.string(),
  department: z.number().int().nonnegative(),
});

// ─── List & search ──────────────────────────────────────────────────────────

const cashierNameLocalizationSchema = z.object({
  language: z.enum([...AVAILABLE_LANGUAGES, "multi"]),
  content: z.string(),
});

export const cashierListItemSchema = z.object({
  deskId: z.string(),
  internalId: z.number().int().nonnegative(),
  name: z.record(z.string(), cashierNameLocalizationSchema),
});

export const cashierListResponseSchema = z.array(cashierListItemSchema);

export const classifierSearchItemSchema = z.object({
  code: z.string(),
  // Optional: server may emit `{ code }` without `title` when the classifier
  // entry exists in fuse but lacks a translation in the requested language.
  title: z.string().optional(),
});

export const classifierSearchResponseSchema = z.array(classifierSearchItemSchema);

// ─── Detail responses ───────────────────────────────────────────────────────
//
// Mirror the `pick + extend` shape produced by serializeForWire on the server.
// Decimal columns (Prisma) arrive as numbers (z.number()), bigint as numeric
// strings, and dates as ISO strings — matching the prisma-zod-generator output
// the server validates against before responding.

const receiptPickSchema = z.object({
  srcId: z.number().int(),
  time: z.string().regex(/^\d+$/, "Invalid bigint string"),
  tin: z.string(),
  fiscal: z.string().nullable(),
  sn: z.string(),
  address: z.string().nullable(),
  total: z.number(),
  taxpayer: z.string(),
  change: z.number(),
});

const cashierPickSchema = z.object({
  internalId: z.number().int().nonnegative(),
  deskId: z.string(),
  name: z.array(localizationEntrySchema),
});

const departmentPickSchema = z.object({
  internalId: z.number().int().nonnegative(),
  taxRegime: taxRegimeSchema,
  title: z.array(localizationEntrySchema),
});

const offerPickSchema = z.object({
  type: offerTypeSchema,
  classifierCode: z.string(),
  title: z.array(localizationEntrySchema),
});

const saleItemPickSchema = z.object({
  srcId: z.number().int(),
  quantity: z.number(),
  price: z.number(),
  unit: unitSchema,
  discount: z.number().nullable(),
  discountType: discountTypeSchema,
  additionalDiscount: z.number().nullable(),
  additionalDiscountType: additionalDiscountTypeSchema,
  department: departmentPickSchema,
  offer: offerPickSchema,
});

const saleRefundPickSchema = z.object({
  nonCashAmount: z.number(),
  cashAmount: z.number(),
  receipt: receiptPickSchema.nullable(),
  items: z.array(z.object({ quantity: z.number() })),
});

export const saleDetailResponseSchema = z.object({
  id: z.number().int().nonnegative(),
  createdAt: isoDateTimeSchema,
  buyerTin: z.string().nullable(),
  cashAmount: z.number(),
  nonCashAmount: z.number(),
  prepaymentAmount: z.number(),
  compensationAmount: z.number(),
  receipt: receiptPickSchema.nullable(),
  refunds: z.array(saleRefundPickSchema),
  cashier: cashierPickSchema,
  items: z.array(saleItemPickSchema),
});

const prepaymentRefundPickSchema = z.object({
  nonCashAmount: z.number(),
  cashAmount: z.number(),
  receipt: receiptPickSchema.nullable(),
});

export const prepaymentDetailResponseSchema = z.object({
  id: z.number().int().nonnegative(),
  createdAt: isoDateTimeSchema,
  buyerTin: z.string().nullable(),
  cashAmount: z.number(),
  nonCashAmount: z.number(),
  receipt: receiptPickSchema.nullable(),
  refund: prepaymentRefundPickSchema.nullable(),
  cashier: cashierPickSchema,
});

// ─── Inferred types ─────────────────────────────────────────────────────────

export type RegisterSaleResponse = z.infer<typeof registerSaleResponseSchema>;
export type RegisterSaleRefundResponse = z.infer<typeof registerSaleRefundResponseSchema>;
export type RegisterPrepaymentResponse = z.infer<typeof registerPrepaymentResponseSchema>;
export type RegisterPrepaymentRefundResponse = z.infer<
  typeof registerPrepaymentRefundResponseSchema
>;
export type CreateOfferResponse = z.infer<typeof createOfferResponseSchema>;
export type CreateCashierResponse = z.infer<typeof createCashierResponseSchema>;
export type CreateDepartmentResponse = z.infer<typeof createDepartmentResponseSchema>;
export type CashierListItem = z.infer<typeof cashierListItemSchema>;
export type ClassifierSearchItem = z.infer<typeof classifierSearchItemSchema>;
export type SaleDetail = z.infer<typeof saleDetailResponseSchema>;
export type PrepaymentDetail = z.infer<typeof prepaymentDetailResponseSchema>;
