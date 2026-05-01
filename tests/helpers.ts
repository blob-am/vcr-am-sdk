import { type Mock, vi } from "vitest";

import type { SaleData } from "../src/types";

export type FetchCall = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | undefined;
  signal: AbortSignal | undefined;
};

export type FetchResponseDescriptor = {
  status?: number;
  body?: unknown;
  /** Override JSON serialization with a raw string body. */
  rawBody?: string;
  delayMs?: number;
};

export type FetchMock = Mock<typeof fetch> & { calls: FetchCall[] };

export function makeFetchMock(
  responder:
    | FetchResponseDescriptor
    | ((call: FetchCall) => FetchResponseDescriptor | Promise<FetchResponseDescriptor>),
): FetchMock {
  const calls: FetchCall[] = [];

  const impl: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";

    const headers: Record<string, string> = {};
    const rawHeaders = init?.headers;
    if (rawHeaders instanceof Headers) {
      rawHeaders.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });
    } else if (Array.isArray(rawHeaders)) {
      for (const [key, value] of rawHeaders) {
        headers[key.toLowerCase()] = value;
      }
    } else if (rawHeaders !== undefined) {
      for (const [key, value] of Object.entries(rawHeaders)) {
        if (typeof value === "string") {
          headers[key.toLowerCase()] = value;
        }
      }
    }

    const body = typeof init?.body === "string" ? init.body : undefined;
    const signal = init?.signal ?? undefined;

    const call: FetchCall = { url, method, headers, body, signal };
    calls.push(call);

    const descriptor = typeof responder === "function" ? await responder(call) : responder;

    if (descriptor.delayMs !== undefined) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, descriptor.delayMs);
        signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(signal.reason ?? new Error("Aborted"));
        });
      });
    }

    const status = descriptor.status ?? 200;
    const responseBody =
      descriptor.rawBody ?? (descriptor.body === undefined ? "" : JSON.stringify(descriptor.body));

    return new Response(responseBody, {
      status,
      headers: { "content-type": "application/json" },
    });
  };

  return Object.assign(vi.fn(impl), { calls });
}

export const VALID_SALE: SaleData = {
  cashier: { id: 1 },
  items: [
    {
      offer: { externalId: "sku-1" },
      department: { id: 1 },
      quantity: "1",
      price: "1000",
      unit: "pc",
    },
  ],
  amount: { cash: "1000" },
  buyer: { type: "individual" },
};

export const VALID_SALE_RESPONSE = {
  urlId: "abc123",
  saleId: 42,
  crn: "CRN-12345",
  srcReceiptId: 9876,
  fiscal: "FISCAL-XYZ",
};
