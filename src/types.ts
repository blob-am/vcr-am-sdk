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

type ExistingOffer = { externalId: string };

type LocalizedOfferTitle = {
  type: "localized";
  content: Partial<Record<Language, string>> & { hy: string };
  localizationStrategy: "translation" | "transliteration";
};

type UniversalOfferTitle = {
  type: "universal";
  content: string;
};

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

export type Offer = NewOffer | ExistingOffer;

export type SaleItem = {
  offer: Offer;
  department: DepartmentInput;
  quantity: string;
  price: string;
  unit: Unit;
  discounts?: Discounts;
  totalAmountTolerance?: string;
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

type IndividualBuyer = {
  type: "individual";
  receipt?: SendReceiptToBuyer;
};

type LegalEntityBuyer = {
  type: "business_entity";
  tin: string;
  receipt?: SendReceiptToBuyer;
};

export type Buyer = IndividualBuyer | LegalEntityBuyer;

export type RegisterSaleInput = {
  cashier: CashierId;
  items: SaleItem[];
  amount: SaleAmount;
  buyer: Buyer;
};

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
};

export type CreateOfferInputProduct = {
  type: "product";
  classifierCode: string;
  title: {
    value: LocalizedName;
    localizationStrategy: "translation" | "transliteration";
  };
  defaultMeasureUnit: Unit;
  defaultDepartment: DepartmentInput;
  externalId?: string;
};

export type CreateOfferInputService = Omit<CreateOfferInputProduct, "type"> & {
  type: "service";
};

export type CreateOfferInput = CreateOfferInputProduct | CreateOfferInputService;
