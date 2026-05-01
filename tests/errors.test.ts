import { describe, expect, it } from "vitest";

import { VCRApiError, VCRError, VCRNetworkError, VCRValidationError } from "../src/errors";

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
