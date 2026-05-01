export const unitsKeys = [
  "pc",
  "unit",
  "set",
  "box",
  "pack",
  "case",
  "hr",
  "sess",
  "proj",
  "sub",
  "kg",
  "l",
  "m",
  "g",
  "ml",
  "cm",
  "bottle",
  "can",
  "jar",
  "bag",
  "m2",
  "dozen",
  "pair",
  "mm",
  "roll",
  "tube",
  "km",
  "ton",
  "m3",
  "pallet",
  "other",
] as const;

export const AVAILABLE_LANGUAGES = ["hy", "ru", "en"] as const;

export const REFUND_REASONS = [
  "customer_request",
  "defective_goods",
  "wrong_goods",
  "cashier_error",
  "duplicate_receipt",
  "other",
] as const;

export const TAX_REGIMES = ["vat", "vat_exempt", "turnover_tax", "micro_enterprise"] as const;

export const DEFAULT_API_URL = "https://vcr.am/api/v1";
export const DEFAULT_TIMEOUT_MS = 30_000;
