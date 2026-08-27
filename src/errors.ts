import type { z } from "zod";

export type ApiErrorIssue = {
  path: Array<string | number>;
  message: string;
  code: string;
};

/**
 * A document VCR persisted and queued for automatic resubmission to SRC.
 *
 * Present on a 502 when SRC was merely unreachable. It means the request was
 * NOT lost: VCR owns the work and a background sweep usually completes it
 * within minutes. Poll `statusUrl` to find out; do NOT resend the request,
 * which would produce a second fiscal receipt.
 */
export type PendingResource = {
  /** Which collection `id` belongs to, e.g. `"sale"` or `"prepayment"`. */
  type: string;
  id: number;
  /** Path to poll for the outcome, e.g. `/api/v1/sales/5122`. */
  statusUrl: string;
};

export type ApiErrorBody = {
  error: string;
  issues?: Array<ApiErrorIssue>;
  /**
   * Server-generated correlation ID, present on unexpected 5xx responses.
   * Include it when reporting the issue to support so the matching log entry
   * and Sentry event can be located.
   */
  requestId?: string;
  /**
   * Set when the request was persisted despite the error. Its absence on an
   * error means nothing was created.
   */
  pending?: PendingResource;
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
