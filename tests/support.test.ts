import { describe, expect, it } from "vitest";

import {
  DEFAULT_API_URL,
  type RequestAttempt,
  VCRApiError,
  VCRClient,
  VCRNetworkError,
  VCRValidationError,
} from "../src";

import { makeFetchMock, VALID_SALE } from "./helpers";

const TRACE_ID = "f05e07ec81806aa151500c414d14d53b";

function observed(fetchMock: ReturnType<typeof makeFetchMock>) {
  const attempts: RequestAttempt[] = [];
  const client = new VCRClient("k", {
    fetch: fetchMock,
    onRequestAttempt: (attempt) => attempts.push(attempt),
  });
  return { client, attempts };
}

describe("VCRClient.submitSupportReport", () => {
  it("POSTs the report and returns the reference", async () => {
    const fetchMock = makeFetchMock({
      status: 201,
      body: { reference: "7K4M-2QXD", createdAt: "2026-11-16T12:58:14.466Z" },
    });
    const client = new VCRClient("k", { fetch: fetchMock });

    const receipt = await client.submitSupportReport({
      message: "Order 8402 is paid, no receipt",
      context: { order: { status: "pending" } },
      traceIds: [TRACE_ID],
    });

    expect(receipt.reference).toBe("7K4M-2QXD");
    expect(fetchMock.calls[0]?.method).toBe("POST");
    expect(fetchMock.calls[0]?.url).toBe(`${DEFAULT_API_URL}/support/reports`);
    expect(JSON.parse(fetchMock.calls[0]?.body ?? "")).toEqual({
      message: "Order 8402 is paid, no receipt",
      context: { order: { status: "pending" } },
      traceIds: [TRACE_ID],
    });
  });

  it("surfaces the size refusal as an API error", async () => {
    const fetchMock = makeFetchMock({
      status: 413,
      body: { error: "`context` is 300011 bytes; the limit is 262144.", code: "context_too_large" },
    });
    const client = new VCRClient("k", { fetch: fetchMock });

    await expect(client.submitSupportReport({ context: { dump: "x" } })).rejects.toMatchObject({
      kind: "api",
      status: 413,
    });
  });
});

describe("onRequestAttempt", () => {
  it("reports a successful call with the server's trace id", async () => {
    const { client, attempts } = observed(
      makeFetchMock({ body: [], headers: { "VCR-Trace-Id": TRACE_ID } }),
    );

    await client.listCashiers();

    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({
      method: "GET",
      path: "/cashiers",
      status: 200,
      traceId: TRACE_ID,
      idempotencyKey: null,
      failure: null,
    });
    expect(attempts[0]?.startedAt).toBeInstanceOf(Date);
    expect(attempts[0]?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("keeps the query string out of the path", async () => {
    const { client, attempts } = observed(makeFetchMock({ body: [] }));

    await client.listPrepayments({ customerRef: "buyer@example.com" });

    expect(attempts[0]?.path).toBe("/prepayments");
    expect(attempts[0]?.traceId).toBeNull();
  });

  it("reports a refused call with its status, message and idempotency key", async () => {
    const { client, attempts } = observed(
      makeFetchMock({
        status: 401,
        body: { error: "Invalid API key" },
        headers: { "VCR-Trace-Id": TRACE_ID },
      }),
    );

    await expect(
      client.registerSale(VALID_SALE, { idempotencyKey: "order-8402" }),
    ).rejects.toBeInstanceOf(VCRApiError);

    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({
      status: 401,
      traceId: TRACE_ID,
      idempotencyKey: "order-8402",
      failure: "Invalid API key",
    });
  });

  it("reports a call that got no response", async () => {
    const fetchMock = makeFetchMock(() => {
      throw new Error("getaddrinfo ENOTFOUND vcr.am");
    });
    const { client, attempts } = observed(fetchMock);

    await expect(client.listCashiers()).rejects.toBeInstanceOf(VCRNetworkError);

    expect(attempts[0]).toMatchObject({
      status: null,
      traceId: null,
      failure: "getaddrinfo ENOTFOUND vcr.am",
    });
  });

  it("reports a 2xx whose body does not fit as a failure", async () => {
    const { client, attempts } = observed(
      makeFetchMock({ body: { unexpected: true }, headers: { "VCR-Trace-Id": TRACE_ID } }),
    );

    await expect(client.whoami()).rejects.toBeInstanceOf(VCRValidationError);

    expect(attempts[0]?.status).toBe(200);
    expect(attempts[0]?.traceId).toBe(TRACE_ID);
    expect(attempts[0]?.failure).toContain("did not match expected schema");
  });

  it("returns the real outcome when the observer throws, and raises its error separately", async () => {
    const uncaught: unknown[] = [];
    const onUncaught = (error: unknown) => uncaught.push(error);
    process.on("uncaughtException", onUncaught);
    try {
      const client = new VCRClient("k", {
        fetch: makeFetchMock({ body: [] }),
        onRequestAttempt: () => {
          throw new Error("journal is down");
        },
      });

      await expect(client.listCashiers()).resolves.toEqual([]);
      await new Promise((resolve) => setTimeout(resolve, 0));
    } finally {
      process.off("uncaughtException", onUncaught);
    }

    expect(uncaught).toHaveLength(1);
    expect(uncaught[0]).toMatchObject({ message: "journal is down" });
  });
});
