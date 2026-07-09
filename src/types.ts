import type { AVAILABLE_LANGUAGES, REFUND_REASONS, TAX_REGIMES, unitsKeys } from "./constants";

/**
 * Object where at least one of the listed keys must be present.
 * Inlined here to avoid pulling type-fest into runtime dependents.
 */
type RequireAtLeastOne<T, K extends keyof T = keyof T> = Omit<T, K> &
  { [P in K]-?: Required<Pick<T, P>> & Partial<Pick<T, Exclude<K, P>>> }[K];

export type Unit = (typeof unitsKeys)[number];
export type Language = (typeof AVAILABLE_LANGUAGES)[number];
export type RefundReason = (typeof REFUND_REASONS)[number];
export type TaxRegime = (typeof TAX_REGIMES)[number];

type CashierInternalId = { id: number };
type CashierDeskId = { deskId: string };
export type CashierId = CashierInternalId | CashierDeskId;

type PercentDiscount = { type: "percent"; value: string };
type AbsoluteDiscount = { type: "price" | "total"; value: string };
type AbsoluteAdditionalDiscount = { type: "total"; value: string };

type BaseDiscount = PercentDiscount | AbsoluteDiscount;
type AdditionalDiscount = PercentDiscount | AbsoluteAdditionalDiscount;

export type Discounts = {
  base?: BaseDiscount;
  additional?: AdditionalDiscount;
};

/** Reference an already-created offer by its merchant-provided external id. */
type ExistingOfferByExternalId = { externalId: string };
/** Reference an already-created offer by its VCR-internal numeric id. */
type ExistingOfferById = { id: number };

type LocalizedOfferTitle = {
  type: "localized";
  content: Partial<Record<Language, string>> & { hy: string };
  localizationStrategy: "translation" | "transliteration";
};

type UniversalOfferTitle = {
  type: "universal";
  content: string;
};

/**
 * Canonical offer-title shape shared by inline new offers (`registerSale`),
 * `createOffer`, and `updateOffer`.
 *
 * - `universal` — one string treated as multi-language (brand names like
 *   "Coca-Cola").
 * - `localized` — per-language map (`hy` required; `en`/`ru` optional and
 *   filled server-side per `localizationStrategy` when missing).
 */
export type OfferTitle = LocalizedOfferTitle | UniversalOfferTitle;

export type DepartmentInput = { id: number };

export type NewOffer = {
  title: OfferTitle;
  type: "product" | "service";
  classifierCode: string;
  defaultMeasureUnit: Unit;
  defaultDepartment: DepartmentInput;
  externalId: string;
};

/**
 * A sale-item offer: a brand-new inline offer, or a reference to an existing
 * one by `externalId` or by internal `id`. Mirrors the three wire shapes the
 * server's `POST /sales` accepts.
 */
export type Offer = NewOffer | ExistingOfferByExternalId | ExistingOfferById;

export type SaleItem = {
  offer: Offer;
  department: DepartmentInput;
  quantity: string;
  /**
   * Unit price. AMD by default. When {@link SaleItem.currency} is set to a
   * non-AMD code, this value is denominated in that foreign currency and VCR
   * converts it to AMD server-side at the authoritative CBA rate — never send
   * a pre-converted AMD figure alongside a `currency`.
   */
  price: string;
  /**
   * Optional ISO 4217 input currency for foreign-currency sales (HO-234-N,
   * server-side conversion). Omit — or set to `"AMD"` — for a native AMD line.
   *
   * When set to a non-AMD code (e.g. `"USD"`, `"RUB"`), `price` is read in that
   * currency and VCR converts every line to AMD at the previous-business-day
   * CBA mid-market rate; the fiscal receipt is always issued in AMD. All
   * foreign-priced items in one sale MUST share the same currency — mixing two
   * currencies, or AMD and foreign lines, in a single sale is rejected. Pair
   * with `autoSettle` (see {@link RegisterSaleInput}) so you don't have to know
   * the AMD total up front, and preview the applied rate via
   * {@link VCRClient.getExchangeRate}. Normalized to uppercase server-side.
   */
  currency?: string;
  unit: Unit;
  discounts?: Discounts;
  totalAmountTolerance?: string;
  /**
   * eMark codes for this line (Govt Decision 1976-N, effective 2026-05-01).
   * Omit or leave empty for unmarked goods. One entry per physical unit sold.
   */
  emarks?: string[];
};

export type SaleAmount = RequireAtLeastOne<{
  prepayment?: string;
  compensation?: string;
  nonCash?: string;
  cash?: string;
}>;

export type SendReceiptToBuyer = {
  email: string;
  language: Language;
};

/**
 * Buyer contact captures used by the desk-side prepayment lookup banner.
 * Independent of {@link SendReceiptToBuyer}: a buyer can be reachable for
 * later lookup without receiving an emailed receipt now. When both
 * `email` and `receipt.email` are present, the server stores `email` for
 * lookup and uses `receipt.email` only for delivery (they may
 * legitimately differ — personal vs billing).
 *
 * `phone` must be E.164 ("+37491234567"). Plain Armenian local format
 * is not accepted at the API boundary — clients should parse with
 * libphonenumber before sending.
 */
type BuyerContact = {
  email?: string;
  phone?: string;
};

type IndividualBuyer = BuyerContact & {
  type: "individual";
  receipt?: SendReceiptToBuyer;
};

type LegalEntityBuyer = BuyerContact & {
  type: "business_entity";
  tin: string;
  receipt?: SendReceiptToBuyer;
};

export type Buyer = IndividualBuyer | LegalEntityBuyer;

/**
 * Derived-total payment: name a single tender and VCR settles the whole
 * server-computed AMD cart total on it. Only `cash` / `nonCash` — `prepayment`
 * and `compensation` are ledger draws that must be stated explicitly via
 * {@link SaleAmount}. Ideal for foreign-currency sales (the AMD total isn't
 * known client-side) or any sale that would rather not sum the cart itself.
 */
export type AutoSettle = {
  tender: "cash" | "nonCash";
};

/** Explicit AMD amount per tender. Mutually exclusive with `autoSettle`. */
type PayByAmount = { amount: SaleAmount; autoSettle?: never };

/** VCR derives the AMD total onto one tender. Mutually exclusive with `amount`. */
type PayByAutoSettle = { autoSettle: AutoSettle; amount?: never };

/**
 * A sale settles EITHER by explicit `amount` OR by `autoSettle` — exactly one,
 * never both. The `never` guards make passing both a compile error, mirroring
 * the server's cross-field validation.
 */
export type SalePayment = PayByAmount | PayByAutoSettle;

export type RegisterSaleInput = {
  cashier: CashierId;
  items: SaleItem[];
  buyer: Buyer;
} & SalePayment;

/** @deprecated Use {@link RegisterSaleInput} instead. Will be removed in 1.0. */
export type SaleData = RegisterSaleInput;

export type ClassifierType = "product" | "service";

export type SearchClassifierInput = {
  query: string;
  type: ClassifierType;
  language: Language;
};

export type RefundItemInput = {
  srcId: number;
  quantity: string;
  emarks?: string[];
};

export type RefundAmount = RequireAtLeastOne<{
  cash?: string;
  nonCash?: string;
}>;

export type RegisterSaleRefundInput = {
  cashier: CashierId;
  saleId: number;
  receipt?: SendReceiptToBuyer;
  reason?: RefundReason;
  reasonNote?: string;
  refundAmounts?: RefundAmount;
  items?: RefundItemInput[];
};

export type PrepaymentAmount = RequireAtLeastOne<{
  cash?: string;
  nonCash?: string;
}>;

export type RegisterPrepaymentInput = {
  cashier: CashierId;
  amount: PrepaymentAmount;
  buyer: Buyer;
};

export type RegisterPrepaymentRefundInput = {
  cashier: CashierId;
  prepaymentId: number;
  receipt?: SendReceiptToBuyer;
  reason?: RefundReason;
  reasonNote?: string;
};

export type LocalizedName = Partial<Record<Language, string>> & { hy: string };

/**
 * Legacy offer-title shape (`{ value, localizationStrategy }`) once required by
 * `createOffer`.
 *
 * @deprecated since 0.14.0 — the server still accepts it but plans removal.
 *   Prefer the canonical {@link OfferTitle} (`{ type: "localized", content,
 *   localizationStrategy }` or `{ type: "universal", content }`), which is the
 *   same shape used by inline offers and `updateOffer`, and additionally
 *   supports `universal` (brand-name) titles.
 */
export type LegacyOfferTitle = {
  value: LocalizedName;
  localizationStrategy: "translation" | "transliteration";
};

/** Title accepted by {@link CreateOfferInput}: canonical or legacy shape. */
export type CreateOfferTitle = OfferTitle | LegacyOfferTitle;

export type CreateCashierInput = {
  name: {
    value: LocalizedName;
    localizationStrategy: "translation" | "transliteration";
  };
  /** 4–8 digit numeric PIN. */
  password: string;
};

export type CreateDepartmentInput = {
  externalId?: string;
  taxRegime: TaxRegime;
  /**
   * Department title shown on reports and receipts. `value.hy` is required;
   * `value.ru` and `value.en` are optional and auto-transliterated from
   * `hy` at render time when missing. `localizationStrategy` follows the
   * same shape used by `CreateCashierInput.name` and `CreateOfferInput.title`.
   */
  title: {
    value: LocalizedName;
    localizationStrategy: "translation" | "transliteration";
  };
};

export type CreateOfferInputProduct = {
  type: "product";
  classifierCode: string;
  title: CreateOfferTitle;
  defaultMeasureUnit: Unit;
  defaultDepartment: DepartmentInput;
  externalId?: string;
};

export type CreateOfferInputService = Omit<CreateOfferInputProduct, "type"> & {
  type: "service";
};

export type CreateOfferInput = CreateOfferInputProduct | CreateOfferInputService;

/** Body of {@link VCRClient.updateOffer} — a new title for an existing offer. */
export type UpdateOfferInput = {
  title: OfferTitle;
};

/** Filter for {@link VCRClient.listOffers}. */
export type ListOffersFilter = {
  /** Exact-match filter by merchant-provided `externalId`. */
  externalId?: string;
  /** Filter by offer type. */
  type?: "product" | "service";
  /** When true, also include archived offers. Defaults to false. */
  includeArchived?: boolean;
};
