import type { z } from "zod";

export type ApiErrorIssue = {
  path: Array<string | number>;
  message: string;
  code: string;
};

/**
 * A document VCR persisted despite the error. Its presence means the request
 * was NOT lost, so never resend blindly — read `mayResubmit` first.
 *
 * Present on two statuses:
 *
 * - **502** — SRC was unreachable. What to do next is `mayResubmit`.
 * - **409** — SRC answered and refused the document on business grounds (for
 *   example 196, the cash register is not activated at SRC). `mayResubmit` is
 *   always false here: the same payload earns the same refusal. Read the SRC
 *   code in `error`, fix the cause, then send the corrected document.
 */
export type PendingResource = {
  /**
   * Which collection `id` belongs to: `"sale"`, `"prepayment"`, or
   * `"sale_refund"`. Deliberately a plain string — a server that adds a type
   * must not break parsing in an older SDK.
   */
  type: string;
  id: number;
  /**
   * Path to poll for the outcome, e.g. `/api/v1/sales/5122`. For
   * `"sale_refund"` this is the PARENT SALE: find your refund by `id` in the
   * response's `refunds` array.
   */
  statusUrl: string;
  /**
   * Whether sending this exact request again is safe.
   *
   * `false` — the document is still VCR's to settle: SRC may have registered
   * it already, or VCR will submit it again for you. Resending risks a second
   * fiscal receipt for one sale. Poll `statusUrl` instead.
   *
   * `true` — SRC registered nothing and VCR will not send it again (the
   * merchant has late fiscalization off, which is the default). Nothing
   * further happens server-side; resubmitting is how the document gets
   * fiscalized.
   *
   * Absent when the server predates the field. Treat that as `false` — the
   * conservative reading, and what those servers did.
   */
  mayResubmit?: boolean;
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
