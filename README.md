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
  - [Account](#account)
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

### Account

| Method       | Endpoint      | Returns  |
| ------------ | ------------- | -------- |
| `whoami()`   | `GET /whoami` | `Whoami` |

`whoami()` resolves which VCR the API key belongs to and whether it is a `production` or `sandbox` key — a cheap health-check. It works on freshly-imported registers that have not been activated yet (`crn` is `null` in that case).

```typescript
const me = await vcr.whoami();
console.log(me.vcrId, me.mode, me.businessEntity.tin);
```

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

**Payment: `amount` or `autoSettle`.** A sale settles by *exactly one* of these — never both (the types enforce it):

- `amount` — explicit AMD per tender (`{ cash?, nonCash?, prepayment?, compensation? }`), as in the quick-start.
- `autoSettle: { tender: "cash" | "nonCash" }` — VCR computes the AMD cart total and charges the whole of it to that one tender. Zero-tap: you don't sum the cart yourself, and it's the only sane option for a foreign-currency sale (you can't know the AMD total up front).

**eMark codes** (marked goods, Govt Decision 1976-N) go on each sale item as `emarks: string[]`; the same codes are echoed on refund items.

**Foreign-currency sales** (HO-234-N): set `currency` on each item and price that item in the foreign currency. VCR converts every line to AMD server-side at the previous-business-day CBA mid-market rate; the fiscal receipt is always AMD. All foreign-priced items in one sale must share the same currency, and mixing AMD with foreign lines is rejected. Preview the rate first with [`getExchangeRate`](#exchange-rate).

```typescript
await vcr.registerSale({
  cashier: { id: 1 },
  items: [
    // price is in USD; VCR converts to AMD.
    { offer: { id: 5 }, department: { id: 1 }, quantity: "1", price: "10", currency: "USD", unit: "pc" },
  ],
  autoSettle: { tender: "cash" }, // AMD total is server-derived
  buyer: { type: "individual" },
});
```

### Prepayments

| Method                                     | Endpoint                     | Returns                            |
| ------------------------------------------ | ---------------------------- | ---------------------------------- |
| `registerPrepayment(input)`                | `POST /prepayments`          | `RegisterPrepaymentResponse`       |
| `getPrepayment(id)`                        | `GET /prepayments/{id}`      | `PrepaymentDetail`                 |
| `registerPrepaymentRefund(input)`          | `POST /prepayments/refund`   | `RegisterPrepaymentRefundResponse` |
| `listPrepayments(filter?)`                 | `GET /prepayments`           | `PrepaymentListItem[]`             |
| `getCustomerPrepaymentBalance({ ... })`    | `GET /prepayments/balance`   | `CustomerPrepaymentBalance`        |

`listPrepayments({ customerRef?, state? })` returns up to 500 rows, each carrying the ledger-derived `remaining` and `state` (`open` / `consumed` / `refunded`). `getCustomerPrepaymentBalance({ customerRef })` returns the customer's open balance, scoped to the business entity that owns the calling VCR's key.

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

| Method                       | Endpoint             | Returns                    |
| ---------------------------- | -------------------- | -------------------------- |
| `createOffer(input)`         | `POST /offers`       | `CreateOfferResponse`      |
| `listOffers(filter?)`        | `GET /offers`        | `OfferListItem[]`          |
| `getOffer(id)`               | `GET /offers/{id}`   | `OfferListItem`            |
| `updateOffer(id, { title })` | `PATCH /offers/{id}` | `OfferListItem`            |
| `createDepartment(input)`    | `POST /departments`  | `CreateDepartmentResponse` |
| `listDepartments()`          | `GET /departments`   | `DepartmentListItem[]`     |

`listOffers({ externalId?, type?, includeArchived? })` is handy for checking whether an offer already exists (by `externalId`) before creating it. `updateOffer` renames an offer's title going forward — already-issued receipts are unchanged. Offer titles use the canonical `OfferTitle` shape (`{ type: "localized" | "universal", ... }`); `createOffer` also still accepts the deprecated legacy `{ value, localizationStrategy }` shape.

```typescript
const [existing] = await vcr.listOffers({ externalId: "sku-coffee" });
if (existing === undefined) {
  await vcr.createOffer({
    type: "product",
    classifierCode: "0901",
    title: { type: "localized", content: { hy: "Սուրճ" }, localizationStrategy: "translation" },
    defaultMeasureUnit: "pc",
    defaultDepartment: { id: 1 },
    externalId: "sku-coffee",
  });
}
```

### Classifier search

```typescript
const matches = await vcr.searchClassifier({
  query: "coffee",
  type: "product",
  language: "en",
});
```

### Exchange rate

| Method                              | Endpoint             | Returns        |
| ----------------------------------- | -------------------- | -------------- |
| `getExchangeRate({ currency })`     | `GET /exchange-rate` | `ExchangeRate` |

Previews the AMD conversion rate VCR would apply to a foreign-currency sale registered now — the CBA mid-market rate published on the previous business day (HO-234-N). Read-only; it does not fiscalize anything. `currency` is a 3-letter ISO 4217 code (case-insensitive); `AMD` is rejected.

```typescript
const rate = await vcr.getExchangeRate({ currency: "USD" });
// { currency: "USD", ratePerUnit: 397.12, amount: 1, rateDate: "2026-07-08", ... }
const amdEquivalent = Number(usdPrice) * rate.ratePerUnit;
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

**The SDK does not retry.** This is intentional. The fiscal API does not currently support idempotency keys, so retrying a `registerSale` after a network blip can double-fiscalize a receipt. Implement application-level retry only on operations you have confirmed are safe to repeat (typically reads: `whoami`, `getSale`, `getPrepayment`, `listPrepayments`, `listCashiers`, `listOffers`, `getOffer`, `listDepartments`, `searchClassifier`, `getExchangeRate`).

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
