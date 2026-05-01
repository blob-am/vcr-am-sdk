export { VCRClient, type VCRClientOptions } from "./client";
export * from "./constants";
export {
  type ApiErrorBody,
  type ApiErrorIssue,
  VCRApiError,
  VCRError,
  VCRNetworkError,
  VCRValidationError,
} from "./errors";
export type { RequestOptions } from "./fetch";
export {
  type CashierListItem,
  type ClassifierSearchItem,
  type CreateCashierResponse,
  type CreateDepartmentResponse,
  type CreateOfferResponse,
  cashierListItemSchema,
  cashierListResponseSchema,
  classifierSearchItemSchema,
  classifierSearchResponseSchema,
  createCashierResponseSchema,
  createDepartmentResponseSchema,
  createOfferResponseSchema,
  type PrepaymentDetail,
  prepaymentDetailResponseSchema,
  type RegisterPrepaymentRefundResponse,
  type RegisterPrepaymentResponse,
  type RegisterSaleRefundResponse,
  type RegisterSaleResponse,
  registerPrepaymentRefundResponseSchema,
  registerPrepaymentResponseSchema,
  registerSaleRefundResponseSchema,
  registerSaleResponseSchema,
  type SaleDetail,
  saleDetailResponseSchema,
} from "./schemas";
export * from "./types";
