import type { z } from "zod";

export type ApiErrorIssue = {
  path: Array<string | number>;
  message: string;
  code: string;
};

export type ApiErrorBody = {
  error: string;
  issues?: Array<ApiErrorIssue>;
};

/**
 * Base class for every error thrown by the SDK.
 * Catch this if you want a single catch-all.
 */
export abstract class VCRError extends Error {
  abstract readonly kind: string;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

/**
 * Server returned a non-2xx response with a parseable JSON error body.
 * Mirrors the unified `{ error, issues? }` envelope from /api/v1.
 */
export class VCRApiError extends VCRError {
  readonly kind = "api" as const;

  constructor(
    readonly status: number,
    readonly body: ApiErrorBody,
    readonly url: string,
  ) {
    super(`VCR API ${status}: ${body.error}`);
  }
}

/**
 * Server returned a non-2xx response that did not match the error envelope,
 * or a 2xx response whose body did not match the expected schema.
 */
export class VCRValidationError extends VCRError {
  readonly kind = "validation" as const;

  constructor(
    message: string,
    readonly status: number,
    readonly url: string,
    readonly issues: z.ZodIssue[],
    readonly raw: unknown,
  ) {
    super(message);
  }
}

/**
 * Network-level failure: DNS, connection refused, timeout, abort.
 * The request never produced a parseable HTTP response.
 */
export class VCRNetworkError extends VCRError {
  readonly kind = "network" as const;

  constructor(
    message: string,
    readonly url: string,
    options: { cause: unknown },
  ) {
    super(message, options);
  }
}
