import type { z } from "zod";

import { type ApiErrorBody, VCRApiError, VCRNetworkError, VCRValidationError } from "./errors";
import { apiErrorBodySchema } from "./schemas";

export type RequestOptions = {
  signal?: AbortSignal;
  /** Override per-request timeout in ms. `null` disables the timeout. */
  timeoutMs?: number | null;
};

export type FetchInit = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  apiKey: string;
  body?: unknown;
  fetchImpl: typeof fetch;
  defaultTimeoutMs: number | null;
} & RequestOptions;

export async function requestJson<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  init: FetchInit,
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
