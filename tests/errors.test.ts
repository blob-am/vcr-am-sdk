import { describe, expect, it } from "vitest";

import { VCRApiError, VCRClient } from "../src";
import { VCRError, VCRNetworkError, VCRValidationError } from "../src/errors";

import { makeFetchMock } from "./helpers";

describe("error hierarchy", () => {
  it("VCRApiError extends VCRError", () => {
    const error = new VCRApiError(500, { error: "boom" }, "https://x/y");
    expect(error).toBeInstanceOf(VCRError);
    expect(error).toBeInstanceOf(Error);
    expect(error.kind).toBe("api");
    expect(error.name).toBe("VCRApiError");
    expect(error.status).toBe(500);
    expect(error.url).toBe("https://x/y");
  });

  it("VCRValidationError carries zod issues + raw payload", () => {
    const error = new VCRValidationError("schema mismatch", 200, "https://x/y", [], {
      broken: true,
    });
    expect(error).toBeInstanceOf(VCRError);
    expect(error.kind).toBe("validation");
    expect(error.raw).toEqual({ broken: true });
  });

  it("VCRNetworkError stores cause", () => {
    const cause = new Error("ETIMEDOUT");
    const error = new VCRNetworkError("net failure", "https://x/y", { cause });
    expect(error).toBeInstanceOf(VCRError);
    expect(error.kind).toBe("network");
    expect(error.cause).toBe(cause);
  });
});

describe("VCRApiError.body.requestId", () => {
  it("preserves the server correlation id from a 5xx envelope", async () => {
    const requestId = "1e4b7c2a-0000-4000-8000-000000000000";
    const fetchMock = makeFetchMock({
      status: 500,
      body: { error: "Internal server error", requestId },
    });
    const client = new VCRClient("k", { fetch: fetchMock });

    const error = await client.whoami().catch((e) => e);

    expect(error).toBeInstanceOf(VCRApiError);
    expect(error.status).toBe(500);
    expect(error.body.requestId).toBe(requestId);
  });

  it("leaves requestId undefined when the envelope omits it", async () => {
    const fetchMock = makeFetchMock({
      status: 400,
      body: { error: "Bad request" },
    });
    const client = new VCRClient("k", { fetch: fetchMock });

    const error = await client.whoami().catch((e) => e);

    expect(error).toBeInstanceOf(VCRApiError);
    expect(error.body.requestId).toBeUndefined();
  });
});
