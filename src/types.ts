import type { RequireAtLeastOne } from "type-fest";

import type { AVAILABLE_LANGUAGES, unitsKeys } from "./constants";

type CashierInternalId = {
  id: number;
};

type CashierDeskId = {
  deskId: string;
};

type CashierId = CashierInternalId | CashierDeskId;

export type Unit = (typeof unitsKeys)[number];

type Language = (typeof AVAILABLE_LANGUAGES)[number];

type PercentDiscount = {
  type: "percent";
  value: string;
};

type AbsoluteDiscount = {
  type: "price" | "total";
  value: string;
};

type AbsoluteAdditionalDiscount = {
  type: "total";
  value: string;
};

type BaseDiscount = PercentDiscount | AbsoluteDiscount;
type AdditionalDiscount = PercentDiscount | AbsoluteAdditionalDiscount;

type NoDiscounts = {
  base?: BaseDiscount;
  additional?: AdditionalDiscount;
};

type BaseDiscounts = {
  base: BaseDiscount;
};

type BaseAndAdditionalDiscounts = {
  base: BaseDiscount;
  additional: AdditionalDiscount;
};

type ExistingOffer = {
  externalId: string;
};

type OfferTitle =
  | {
      type: "localizer";
      content: Partial<Record<Language, string>> & {
        hy: string; // required
      };
      localizationStrategy: "translation" | "transliteration";
    }
  | {
      type: "universal";
      content: string;
    };

type NewOffer = {
  title: OfferTitle;
  type: "product" | "service";
  classifierCode: string;
  defaultMeasureUnit: Unit;
  defaultDepartment: {
    internalId: number;
  };
  externalId: string;
};

type Offer = NewOffer | ExistingOffer;

export type SaleItem = {
  offer: Offer;
  department: {
    internalId: number;
  };
  quantity: string;
  price: string;
  unit: Unit;
  discounts?: NoDiscounts | BaseDiscounts | BaseAndAdditionalDiscounts;
  totalAmountTolerance?: string;
};

type SaleAmount = RequireAtLeastOne<{
  prePayment?: string;
  compensation?: string;
  nonCash?: string;
  cash?: string;
}>;

type SendReceiptToBuyer = {
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

type Buyer = IndividualBuyer | LegalEntityBuyer;

export type SaleData = {
  cashier: CashierId;
  items: SaleItem[];
  amount: SaleAmount;
  buyer: Buyer;
};
