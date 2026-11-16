import type { z } from "zod";

import { type ApiErrorBody, VCRApiError, VCRNetworkError, VCRValidationError } from "./errors";
import { apiErrorBodySchema } from "./schemas";

export type RequestOptions = {
  signal?: AbortSignal;
  /** Override per-request timeout in ms. `null` disables the timeout. */
  timeoutMs?: number | null;
  /**
   * Opt-in replay protection for the document-creating endpoints
   * (`registerSale`, `registerSaleRefund`, `registerPrepayment`,
   * `registerPrepaymentRefund`). Retrying a request that carries the same key
   * returns the original response instead of registering a second document.
   *
   * Strongly recommended. Without it, retrying after a 502 or a 409 that
   * carried a `pending` handle produces a duplicate fiscal receipt, which can
   * only be undone by issuing a refund.
   *
   * The SDK deliberately does not generate this for you: the value must stay
   * **stable across your retries**, so it has to come from something you own —
   * typically your order id (`order-4821`) — not from a fresh UUID per call.
   */
  idempotencyKey?: string;
};

/** Response header carrying the server's id for the call. */
export const TRACE_ID_HEADER = "vcr-trace-id";

/**
 * One HTTP call to the VCR API, as it ended. Holds no headers, no bodies and
 * no query string, so it is safe to keep in a journal.
 */
export type RequestAttempt = {
  startedAt: Date;
  method: string;
  /** Path relative to the client's base URL, without the query string. */
  path: string;
  durationMs: number;
  /** `null` when no response arrived: DNS, connect, TLS, timeout, abort. */
  status: number | null;
  /**
   * The server's id for this call. Quote it to support, or pass it in
   * `submitSupportReport({ traceIds })`, and the server's record of the call
   * is found directly. `null` when no response arrived or something other
   * than the API answered.
   */
  traceId: string | null;
  idempotencyKey: string | null;
  /** One line on why the call failed; `null` on success. */
  failure: string | null;
};

export type RequestObserver = (attempt: RequestAttempt) => void;

export type FetchInit = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  /** The route, for the observer: `url` minus the base URL and the query. */
  path: string;
  onRequestAttempt?: RequestObserver;
  apiKey: string;
  body?: unknown;
  fetchImpl: typeof fetch;
  defaultTimeoutMs: number | null;
} & RequestOptions;

export async function requestJson<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  init: FetchInit,
): Promise<z.infer<TSchema>> {
  const observer = init.onRequestAttempt;
  if (observer === undefined) {
    return exchange(schema, init, undefined);
  }

  const startedAt = new Date();
  const startedMs = performance.now();
  const seen: { response: Response | undefined } = { response: undefined };
  const report = (failure: string | null): void => {
    const traceId = seen.response?.headers.get(TRACE_ID_HEADER);
    notify(observer, {
      startedAt,
      method: init.method,
      path: init.path,
      durationMs: Math.round(performance.now() - startedMs),
      status: seen.response?.status ?? null,
      traceId: traceId === undefined || traceId === null || traceId === "" ? null : traceId,
      idempotencyKey: init.idempotencyKey ?? null,
      failure,
    });
  };

  let data: z.infer<TSchema>;
  try {
    data = await exchange(schema, init, seen);
  } catch (error) {
    report(failureOf(error));
    throw error;
  }
  report(null);
  return data;
}

/**
 * The call has an outcome already and the caller must get it. A throwing
 * observer is a bug in the observer, so it surfaces as an uncaught error on
 * its own, instead of replacing the result of a call that may have registered
 * a receipt.
 */
function notify(observer: RequestObserver, attempt: RequestAttempt): void {
  try {
    observer(attempt);
  } catch (error) {
    queueMicrotask(() => {
      throw error;
    });
  }
}

function failureOf(error: unknown): string {
  if (error instanceof VCRApiError) {
    return error.body.error;
  }
  return error instanceof Error ? error.message : String(error);
}

async function exchange<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  init: FetchInit,
  seen: { response: Response | undefined } | undefined,
): Promise<z.infer<TSchema>> {
  const { url, method, apiKey, body, fetchImpl, signal: externalSignal } = init;

  const effectiveTimeout = init.timeoutMs === undefined ? init.defaultTimeoutMs : init.timeoutMs;

  const timeoutController = effectiveTimeout !== null ? new AbortController() : undefined;
  const timeoutHandle =
    timeoutController !== undefined && effectiveTimeout !== null
      ? setTimeout(() => timeoutController.abort(new Error("Request timeout")), effectiveTimeout)
      : undefined;

  const signal = mergeSignals(externalSignal, timeoutController?.signal);

  const headers: Record<string, string> = {
    "x-api-key": apiKey,
    accept: "application/json",
  };
  if (init.idempotencyKey !== undefined) {
    headers["idempotency-key"] = init.idempotencyKey;
  }

  const requestInit: RequestInit = { method, headers };
  if (body !== undefined) {
    headers["content-type"] = "application/json";
    requestInit.body = JSON.stringify(body);
  }
  if (signal !== undefined) {
    requestInit.signal = signal;
  }

  // The whole flow — connect, body read, parse — must be bounded by the same
  // timeout. Clearing the timer earlier (e.g. after fetch resolves) leaves
  // body reading and parsing unprotected against slow/hanging servers.
  try {
    let response: Response;
    let rawText: string;
    try {
      response = await fetchImpl(url, requestInit);
      if (seen !== undefined) {
        seen.response = response;
      }
      rawText = await response.text();
    } catch (cause) {
      throw new VCRNetworkError(
        cause instanceof Error ? cause.message : "Network request failed",
        url,
        { cause },
      );
    }

    const rawJson = rawText.length === 0 ? undefined : safeJsonParse(rawText);

    if (!response.ok) {
      throw buildApiError(response.status, rawJson, url);
    }

    const parsed = schema.safeParse(rawJson);
    if (!parsed.success) {
      throw new VCRValidationError(
        `VCR response did not match expected schema for ${method} ${url}`,
        response.status,
        url,
        parsed.error.issues,
        rawJson,
      );
    }

    return parsed.data;
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }
}

function buildApiError(
  status: number,
  rawJson: unknown,
  url: string,
): VCRApiError | VCRValidationError {
  const parsed = apiErrorBodySchema.safeParse(rawJson);
  if (parsed.success) {
    const body: ApiErrorBody = {
      error: parsed.data.error,
      ...(parsed.data.issues !== undefined && { issues: parsed.data.issues }),
      ...(parsed.data.requestId !== undefined && { requestId: parsed.data.requestId }),
    };
    return new VCRApiError(status, body, url);
  }

  return new VCRValidationError(
    `VCR returned ${status} but the error body did not match the expected envelope`,
    status,
    url,
    parsed.error.issues,
    rawJson,
  );
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function mergeSignals(...signals: ReadonlyArray<AbortSignal | undefined>): AbortSignal | undefined {
  const present = signals.filter((signal): signal is AbortSignal => signal !== undefined);
  if (present.length === 0) {
    return undefined;
  }
  return AbortSignal.any(present);
}
