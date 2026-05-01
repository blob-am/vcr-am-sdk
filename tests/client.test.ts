import { describe, expect, it } from "vitest";

import {
  DEFAULT_API_URL,
  VCRApiError,
  VCRClient,
  VCRNetworkError,
  VCRValidationError,
} from "../src";

import { makeFetchMock, VALID_SALE, VALID_SALE_RESPONSE } from "./helpers";

describe("VCRClient construction", () => {
  it("rejects empty apiKey", () => {
    expect(() => new VCRClient("")).toThrow(/non-empty apiKey/);
  });

  it("uses globalThis.fetch by default", async () => {
    const client = new VCRClient("key");
    expect(client).toBeInstanceOf(VCRClient);
  });

  it("throws if no fetch is available and none is provided", () => {
    const originalFetch = globalThis.fetch;
    Object.defineProperty(globalThis, "fetch", {
      value: undefined,
      configurable: true,
    });
    try {
      expect(() => new VCRClient("key")).toThrow(/fetch implementation/);
    } finally {
      Object.defineProperty(globalThis, "fetch", {
        value: originalFetch,
        configurable: true,
      });
    }
  });

  it("strips trailing slash from baseUrl", async () => {
    const fetchMock = makeFetchMock({ body: VALID_SALE_RESPONSE });
    const client = new VCRClient("key", {
      baseUrl: "https://example.com/api/v1/",
      fetch: fetchMock,
    });
    await client.registerSale(VALID_SALE);
    expect(fetchMock.calls[0]?.url).toBe("https://example.com/api/v1/sales");
  });
});

describe("VCRClient.registerSale", () => {
  it("POSTs to /sales with apiKey header and JSON body", async () => {
    const fetchMock = makeFetchMock({ body: VALID_SALE_RESPONSE });
    const client = new VCRClient("test-key", { fetch: fetchMock });

    const result = await client.registerSale(VALID_SALE);

    expect(result).toEqual(VALID_SALE_RESPONSE);
    expect(fetchMock.calls).toHaveLength(1);

    const call = fetchMock.calls[0];
    expect(call?.url).toBe(`${DEFAULT_API_URL}/sales`);
    expect(call?.method).toBe("POST");
    expect(call?.headers["x-api-key"]).toBe("test-key");
    expect(call?.headers["content-type"]).toBe("application/json");
    expect(call?.headers["accept"]).toBe("application/json");
    expect(JSON.parse(call?.body ?? "")).toEqual(VALID_SALE);
  });

  it("throws VCRApiError on a 4xx with the unified error envelope", async () => {
    const fetchMock = makeFetchMock({
      status: 401,
      body: { error: "Invalid API key" },
    });
    const client = new VCRClient("bad", { fetch: fetchMock });

    const error = await client.registerSale(VALID_SALE).catch((e) => e);

    expect(error).toBeInstanceOf(VCRApiError);
    expect(error.status).toBe(401);
    expect(error.body.error).toBe("Invalid API key");
    expect(error.body.issues).toBeUndefined();
    expect(error.message).toMatch(/401/);
  });

  it("preserves zod issues from validation errors", async () => {
    const fetchMock = makeFetchMock({
      status: 400,
      body: {
        error: "Validation failed",
        issues: [{ path: ["items", 0, "price"], message: "Required", code: "invalid_type" }],
      },
    });
    const client = new VCRClient("k", { fetch: fetchMock });

    const error = await client.registerSale(VALID_SALE).catch((e) => e);

    expect(error).toBeInstanceOf(VCRApiError);
    expect(error.body.issues).toEqual([
      { path: ["items", 0, "price"], message: "Required", code: "invalid_type" },
    ]);
  });

  it("throws VCRValidationError when 2xx body does not match schema", async () => {
    const fetchMock = makeFetchMock({ body: { unexpected: true } });
    const client = new VCRClient("k", { fetch: fetchMock });

    const error = await client.registerSale(VALID_SALE).catch((e) => e);

    expect(error).toBeInstanceOf(VCRValidationError);
    expect(error.status).toBe(200);
    expect(error.issues.length).toBeGreaterThan(0);
    expect(error.raw).toEqual({ unexpected: true });
  });

  it("throws VCRValidationError when error body does not match envelope", async () => {
    const fetchMock = makeFetchMock({
      status: 502,
      rawBody: "<html>Bad Gateway</html>",
    });
    const client = new VCRClient("k", { fetch: fetchMock });

    const error = await client.registerSale(VALID_SALE).catch((e) => e);

    expect(error).toBeInstanceOf(VCRValidationError);
    expect(error.status).toBe(502);
  });

  it("wraps fetch failures in VCRNetworkError", async () => {
    const cause = new Error("ECONNREFUSED");
    const failingFetch: typeof fetch = () => {
      throw cause;
    };

    const client = new VCRClient("k", { fetch: failingFetch });
    const error = await client.registerSale(VALID_SALE).catch((e) => e);

    expect(error).toBeInstanceOf(VCRNetworkError);
    expect(error.cause).toBe(cause);
    expect(error.url).toBe(`${DEFAULT_API_URL}/sales`);
  });

  it("aborts the request when timeoutMs elapses", async () => {
    const fetchMock = makeFetchMock({
      delayMs: 200,
      body: VALID_SALE_RESPONSE,
    });
    const client = new VCRClient("k", { fetch: fetchMock, timeoutMs: 20 });

    const error = await client.registerSale(VALID_SALE).catch((e) => e);

    expect(error).toBeInstanceOf(VCRNetworkError);
  });

  it("times out when body reading hangs after headers are received", async () => {
    // Simulate a server that returns headers fast but streams the body
    // forever. The Response is constructed immediately; only `.text()` blocks.
    const slowBodyFetch: typeof fetch = (_url, init) => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          init?.signal?.addEventListener("abort", () => {
            controller.error(init.signal?.reason ?? new Error("Aborted"));
          });
          // Never enqueue or close — body read hangs until signal aborts.
        },
      });
      return Promise.resolve(
        new Response(stream, {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    };

    const client = new VCRClient("k", {
      fetch: slowBodyFetch,
      timeoutMs: 30,
    });

    const start = Date.now();
    const error = await client.registerSale(VALID_SALE).catch((e) => e);
    const elapsed = Date.now() - start;

    expect(error).toBeInstanceOf(VCRNetworkError);
    expect(elapsed).toBeLessThan(500);
  });

  it("respects per-request timeout override", async () => {
    const fetchMock = makeFetchMock({
      delayMs: 200,
      body: VALID_SALE_RESPONSE,
    });
    const client = new VCRClient("k", { fetch: fetchMock, timeoutMs: null });

    const error = await client.registerSale(VALID_SALE, { timeoutMs: 20 }).catch((e) => e);

    expect(error).toBeInstanceOf(VCRNetworkError);
  });

  it("disables the timeout when timeoutMs is null", async () => {
    // 50ms server delay; default timeout is 20ms (would fire) but we
    // explicitly disable per-request — request must complete.
    const fetchMock = makeFetchMock({
      delayMs: 50,
      body: VALID_SALE_RESPONSE,
    });
    const client = new VCRClient("k", { fetch: fetchMock, timeoutMs: 20 });

    const result = await client.registerSale(VALID_SALE, { timeoutMs: null });
    expect(result).toEqual(VALID_SALE_RESPONSE);
  });

  it("propagates external AbortSignal", async () => {
    const fetchMock = makeFetchMock({
      delayMs: 200,
      body: VALID_SALE_RESPONSE,
    });
    const client = new VCRClient("k", { fetch: fetchMock, timeoutMs: null });

    const controller = new AbortController();
    const promise = client.registerSale(VALID_SALE, { signal: controller.signal });
    controller.abort();

    const error = await promise.catch((e) => e);
    expect(error).toBeInstanceOf(VCRNetworkError);
  });
});

describe("VCRClient.searchClassifierCategory", () => {
  it("GETs /searchByClassifier with all query params", async () => {
    const fetchMock = makeFetchMock({
      body: [
        { code: "1234", title: "Apples" },
        { code: "5678", title: "Oranges" },
      ],
    });
    const client = new VCRClient("k", { fetch: fetchMock });

    const result = await client.searchClassifierCategory("apple", "product", "en");

    expect(result).toEqual([
      { code: "1234", title: "Apples" },
      { code: "5678", title: "Oranges" },
    ]);

    const call = fetchMock.calls[0];
    expect(call?.method).toBe("GET");
    expect(call?.url).toContain("/searchByClassifier");
    const url = new URL(call?.url ?? "");
    expect(url.searchParams.get("query")).toBe("apple");
    expect(url.searchParams.get("type")).toBe("product");
    expect(url.searchParams.get("language")).toBe("en");
  });

  it("does not send a content-type header on GET (no body)", async () => {
    const fetchMock = makeFetchMock({ body: [] });
    const client = new VCRClient("k", { fetch: fetchMock });

    await client.searchClassifierCategory("query", "service", "hy");

    const call = fetchMock.calls[0];
    expect(call?.headers["content-type"]).toBeUndefined();
  });

  it("propagates server-side validation errors as VCRApiError", async () => {
    const fetchMock = makeFetchMock({
      status: 400,
      body: {
        error: "Invalid input",
        issues: [{ path: ["language"], message: "Invalid enum", code: "invalid_value" }],
      },
    });
    const client = new VCRClient("k", { fetch: fetchMock });

    const error = await client.searchClassifierCategory("x", "product", "en").catch((e) => e);

    expect(error).toBeInstanceOf(VCRApiError);
    expect(error.status).toBe(400);
  });
});
