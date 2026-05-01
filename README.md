# `@blob-solutions/vcr-am-sdk`

[![npm version](https://img.shields.io/npm/v/@blob-solutions/vcr-am-sdk?color=cb3837&logo=npm)](https://www.npmjs.com/package/@blob-solutions/vcr-am-sdk)
[![types](https://img.shields.io/npm/types/@blob-solutions/vcr-am-sdk?logo=typescript&logoColor=white)](https://www.npmjs.com/package/@blob-solutions/vcr-am-sdk)
[![CI](https://github.com/blob-am/vcr-am-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/blob-am/vcr-am-sdk/actions/workflows/ci.yml)
[![License: ISC](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)

Official TypeScript / JavaScript SDK for the [VCR.AM](https://vcr.am) Virtual Cash Register API — register sales, refunds, and prepayments through Armenia's State Revenue Committee (SRC).

- **One runtime dep** — just [Zod](https://zod.dev). Native `fetch`, `AbortSignal`, no polyfills.
- **Cross-runtime** — Node 22+, Bun, Deno, modern browsers. ESM + CJS + IIFE.
- **Schema-validated** — every response is parsed with Zod 4; contract drift fails loudly with structured errors.
- **Strict types** — branded errors, `RequireAtLeastOne` amount unions, discriminated buyer / offer types.
- **Verified** — `publint` clean, `attw` 🟢 across all four resolution modes, 100% line coverage.

## Table of contents

- [Installation](#installation)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [API reference](#api-reference)
  - [Sales](#sales)
  - [Prepayments](#prepayments)
  - [Cashiers](#cashiers)
  - [Offers and departments](#offers-and-departments)
  - [Classifier search](#classifier-search)
- [Error handling](#error-handling)
- [Cancellation and timeouts](#cancellation-and-timeouts)
- [Idempotency and retries](#idempotency-and-retries)
- [Browser usage](#browser-usage)
- [Development](#development)
- [Versioning](#versioning)

## Installation

```bash
pnpm add @blob-solutions/vcr-am-sdk
# or: npm install / yarn add / bun add
```

You'll need an API key from your VCR.AM dashboard.

## Quick start

```typescript
import { VCRClient } from "@blob-solutions/vcr-am-sdk";

const apiKey = process.env.VCR_AM_API_KEY;
if (apiKey === undefined) throw new Error("VCR_AM_API_KEY is required");

const vcr = new VCRClient(apiKey);

const { crn, srcReceiptId, fiscal } = await vcr.registerSale({
  cashier: { id: 1 },
  items: [
    {
      offer: { externalId: "sku-coffee" },
      department: { id: 1 },
      quantity: "1",
      price: "1500",
      unit: "pc",
    },
  ],
  amount: { cash: "1500" },
  buyer: { type: "individual" },
});

console.log({ crn, srcReceiptId, fiscal });
```

## Configuration

```typescript
const vcr = new VCRClient(apiKey, {
  baseUrl: "https://vcr.am/api/v1",  // override for staging or self-hosted
  fetch: customFetch,                 // injectable fetch (e.g. undici, MSW)
  timeoutMs: 30_000,                  // default 30s; pass `null` to disable
});
```

Per-request overrides apply to every method's optional second argument:

```typescript
const controller = new AbortController();

await vcr.registerSale(sale, {
  signal: controller.signal,
  timeoutMs: 5_000,
});
```

## API reference

Every method returns a typed, schema-validated response and accepts an optional `RequestOptions` (`{ signal?, timeoutMs? }`) as its last argument.

### Sales

| Method                      | Endpoint            | Returns                       |
| --------------------------- | ------------------- | ----------------------------- |
| `registerSale(input)`       | `POST /sales`       | `RegisterSaleResponse`        |
| `getSale(saleId)`           | `GET /sales/{id}`   | `SaleDetail`                  |
| `registerSaleRefund(input)` | `POST /sales/refund`| `RegisterSaleRefundResponse`  |

```typescript
const refund = await vcr.registerSaleRefund({
  cashier: { id: 1 },
  saleId: 42,
  reason: "customer_request",
  refundAmounts: { cash: "1500" },
  items: [{ srcId: 17, quantity: "1" }],
});
```

### Prepayments

| Method                            | Endpoint                  | Returns                              |
| --------------------------------- | ------------------------- | ------------------------------------ |
| `registerPrepayment(input)`       | `POST /prepayments`       | `RegisterPrepaymentResponse`         |
| `getPrepayment(id)`               | `GET /prepayments/{id}`   | `PrepaymentDetail`                   |
| `registerPrepaymentRefund(input)` | `POST /prepayments/refund`| `RegisterPrepaymentRefundResponse`   |

### Cashiers

| Method                  | Endpoint          | Returns                  |
| ----------------------- | ----------------- | ------------------------ |
| `listCashiers()`        | `GET /cashiers`   | `CashierListItem[]`      |
| `createCashier(input)`  | `POST /cashiers`  | `CreateCashierResponse`  |

```typescript
const cashier = await vcr.createCashier({
  name: {
    value: { hy: "Արամ", en: "Aram" },
    localizationStrategy: "translation",
  },
  password: "1234",
});
```

### Offers and departments

| Method                    | Endpoint             | Returns                     |
| ------------------------- | -------------------- | --------------------------- |
| `createOffer(input)`      | `POST /offers`       | `CreateOfferResponse`       |
| `createDepartment(input)` | `POST /departments`  | `CreateDepartmentResponse`  |

### Classifier search

```typescript
const matches = await vcr.searchClassifier({
  query: "coffee",
  type: "product",
  language: "en",
});
```

## Error handling

All SDK errors derive from `VCRError`. Catch the base class for a single handler, or narrow on the specific subclass.

| Class                | Thrown when                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| `VCRApiError`        | Server returned a non-2xx with the unified `{ error, issues? }` envelope. Carries `status`, `body`, `url`. |
| `VCRValidationError` | Response body did not match the expected schema (2xx or non-envelope error). Carries `issues` (Zod) and `raw`. |
| `VCRNetworkError`    | Network-level failure: DNS, connection refused, abort, timeout. Wraps the underlying error in `cause`.   |

```typescript
import {
  VCRApiError,
  VCRError,
  VCRNetworkError,
  VCRValidationError,
} from "@blob-solutions/vcr-am-sdk";

try {
  await vcr.registerSale(sale);
} catch (error) {
  if (error instanceof VCRApiError) {
    console.error(error.status, error.body.error, error.body.issues);
  } else if (error instanceof VCRValidationError) {
    console.error("unexpected response shape", error.issues, error.raw);
  } else if (error instanceof VCRNetworkError) {
    console.error("network failure", error.cause);
  } else if (error instanceof VCRError) {
    console.error("VCR error", error);
  } else {
    throw error;
  }
}
```

## Cancellation and timeouts

The SDK respects the standard `AbortSignal`:

```typescript
const controller = new AbortController();
setTimeout(() => controller.abort(), 5_000);

await vcr.getSale(42, { signal: controller.signal });
```

The whole request flow — connection, body read, schema parse — is bounded by a single timer. Default timeout is 30 seconds; configurable per-client (`timeoutMs`) and per-request (`{ timeoutMs }`). Pass `null` to disable.

## Idempotency and retries

**The SDK does not retry.** This is intentional. The fiscal API does not currently support idempotency keys, so retrying a `registerSale` after a network blip can double-fiscalize a receipt. Implement application-level retry only on operations you have confirmed are safe to repeat (typically reads: `getSale`, `getPrepayment`, `listCashiers`, `searchClassifier`).

## Browser usage

The IIFE bundle ships at `lib/index.global.js` and exposes a global `vcrsdk`:

```html
<script src="https://unpkg.com/@blob-solutions/vcr-am-sdk/lib/index.global.js"></script>
<script>
  const vcr = new vcrsdk.VCRClient("YOUR_KEY");
</script>
```

For ESM bundlers (Vite, esbuild, Webpack 5+), the package's `"exports"` map will pick the right entry automatically — no special config needed.

## Development

```bash
pnpm install
pnpm check         # lint + typecheck + tests
pnpm test          # vitest run
pnpm test:watch
pnpm test:coverage
pnpm typecheck
pnpm lint          # biome + custom no-`as`-cast check
pnpm lint:fix
pnpm build         # ESM + CJS + IIFE + .d.ts via tsup
pnpm lint:package  # publint + are-the-types-wrong
```

## Versioning

[Semantic Versioning](https://semver.org). See [CHANGELOG.md](CHANGELOG.md) for breaking-change notes; in particular, **0.10.0 fixes two silent bugs** in 0.8.0 (`SaleAmount.prePayment` → `prepayment`, and `searchClassifierCategory` now hits the correct endpoint).

## License

ISC © Alex Kraiz
