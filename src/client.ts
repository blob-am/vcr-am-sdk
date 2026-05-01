import type { z } from "zod";
import { DEFAULT_API_URL, DEFAULT_TIMEOUT_MS } from "./constants";
import { type RequestOptions, requestJson } from "./fetch";
import {
  type CashierListItem,
  type ClassifierSearchItem,
  type CreateCashierResponse,
  type CreateDepartmentResponse,
  type CreateOfferResponse,
  cashierListResponseSchema,
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
import type {
  ClassifierType,
  CreateCashierInput,
  CreateDepartmentInput,
  CreateOfferInput,
  Language,
  RegisterPrepaymentInput,
  RegisterPrepaymentRefundInput,
  RegisterSaleInput,
  RegisterSaleRefundInput,
  SearchClassifierInput,
} from "./types";

export type VCRClientOptions = {
  /** Base URL for the VCR API. Defaults to https://vcr.am/api/v1. */
  baseUrl?: string;
  /** Custom fetch implementation. Defaults to the global `fetch`. */
  fetch?: typeof fetch;
  /** Default request timeout in ms. Pass `null` to disable. Default 30s. */
  timeoutMs?: number | null;
};

type Method = "GET" | "POST";

export class VCRClient {
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;
  readonly #defaultTimeoutMs: number | null;

  constructor(apiKey: string, options: VCRClientOptions = {}) {
    if (apiKey.length === 0) {
      throw new Error("VCRClient requires a non-empty apiKey");
    }
    this.#apiKey = apiKey;
    this.#baseUrl = stripTrailingSlash(options.baseUrl ?? DEFAULT_API_URL);

    const candidate = options.fetch ?? globalThis.fetch;
    if (typeof candidate !== "function") {
      throw new Error(
        "No fetch implementation available. Provide options.fetch or use a runtime that exposes a global fetch.",
      );
    }
    // Only bind the global fetch, which on some runtimes requires `this ===
    // globalThis`. A user-supplied fetch keeps its own `this` so wrappers
    // (e.g. class methods, fetch with closure state) keep working.
    this.#fetch = options.fetch === undefined ? candidate.bind(globalThis) : candidate;

    this.#defaultTimeoutMs =
      options.timeoutMs === undefined ? DEFAULT_TIMEOUT_MS : options.timeoutMs;
  }

  // ─── Sales ─────────────────────────────────────────────────────────────────

  registerSale(
    data: RegisterSaleInput,
    options: RequestOptions = {},
  ): Promise<RegisterSaleResponse> {
    return this.#json("POST", "/sales", registerSaleResponseSchema, data, options);
  }

  getSale(saleId: number, options: RequestOptions = {}): Promise<SaleDetail> {
    assertNonNegativeInt(saleId, "saleId");
    return this.#json("GET", `/sales/${saleId}`, saleDetailResponseSchema, undefined, options);
  }

  registerSaleRefund(
    data: RegisterSaleRefundInput,
    options: RequestOptions = {},
  ): Promise<RegisterSaleRefundResponse> {
    return this.#json("POST", "/sales/refund", registerSaleRefundResponseSchema, data, options);
  }

  // ─── Prepayments ──────────────────────────────────────────────────────────

  registerPrepayment(
    data: RegisterPrepaymentInput,
    options: RequestOptions = {},
  ): Promise<RegisterPrepaymentResponse> {
    return this.#json("POST", "/prepayments", registerPrepaymentResponseSchema, data, options);
  }

  getPrepayment(prepaymentId: number, options: RequestOptions = {}): Promise<PrepaymentDetail> {
    assertNonNegativeInt(prepaymentId, "prepaymentId");
    return this.#json(
      "GET",
      `/prepayments/${prepaymentId}`,
      prepaymentDetailResponseSchema,
      undefined,
      options,
    );
  }

  registerPrepaymentRefund(
    data: RegisterPrepaymentRefundInput,
    options: RequestOptions = {},
  ): Promise<RegisterPrepaymentRefundResponse> {
    return this.#json(
      "POST",
      "/prepayments/refund",
      registerPrepaymentRefundResponseSchema,
      data,
      options,
    );
  }

  // ─── Cashiers ─────────────────────────────────────────────────────────────

  listCashiers(options: RequestOptions = {}): Promise<CashierListItem[]> {
    return this.#json("GET", "/cashiers", cashierListResponseSchema, undefined, options);
  }

  createCashier(
    data: CreateCashierInput,
    options: RequestOptions = {},
  ): Promise<CreateCashierResponse> {
    return this.#json("POST", "/cashiers", createCashierResponseSchema, data, options);
  }

  // ─── Offers / Departments ─────────────────────────────────────────────────

  createOffer(data: CreateOfferInput, options: RequestOptions = {}): Promise<CreateOfferResponse> {
    return this.#json("POST", "/offers", createOfferResponseSchema, data, options);
  }

  createDepartment(
    data: CreateDepartmentInput,
    options: RequestOptions = {},
  ): Promise<CreateDepartmentResponse> {
    return this.#json("POST", "/departments", createDepartmentResponseSchema, data, options);
  }

  // ─── Classifier search ────────────────────────────────────────────────────

  searchClassifier(
    input: SearchClassifierInput,
    options: RequestOptions = {},
  ): Promise<ClassifierSearchItem[]> {
    return this.#json(
      "GET",
      "/searchByClassifier",
      classifierSearchResponseSchema,
      undefined,
      options,
      { query: input.query, type: input.type, language: input.language },
    );
  }

  /**
   * @deprecated Use {@link searchClassifier} with an options object. Will be
   *   removed in 1.0. The new signature accepts `{ query, type, language }` so
   *   future params can be added without breaking the call site.
   */
  searchClassifierCategory(
    query: string,
    type: ClassifierType,
    language: Language,
    options: RequestOptions = {},
  ): Promise<ClassifierSearchItem[]> {
    return this.searchClassifier({ query, type, language }, options);
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  #json<TSchema extends z.ZodTypeAny>(
    method: Method,
    path: string,
    schema: TSchema,
    body: unknown,
    options: RequestOptions,
    query?: Record<string, string>,
  ): Promise<z.infer<TSchema>> {
    const url =
      query === undefined
        ? `${this.#baseUrl}${path}`
        : appendQuery(`${this.#baseUrl}${path}`, query);

    return requestJson(schema, {
      method,
      url,
      apiKey: this.#apiKey,
      ...(body !== undefined && { body }),
      fetchImpl: this.#fetch,
      defaultTimeoutMs: this.#defaultTimeoutMs,
      ...options,
    });
  }
}

function appendQuery(url: string, query: Record<string, string>): string {
  const u = new URL(url);
  for (const [key, value] of Object.entries(query)) {
    u.searchParams.set(key, value);
  }
  return u.toString();
}

function stripTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function assertNonNegativeInt(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer (got ${value})`);
  }
}
