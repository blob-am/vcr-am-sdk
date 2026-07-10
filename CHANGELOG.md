# Changelog

All notable changes to `@blob-solutions/vcr-am-sdk`. The format is loosely based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows [Semantic Versioning](https://semver.org/).

## [0.16.0] — 2026-07-10

### Added

- **`RegisterSaleInput.comment?: string`** — an optional merchant-internal note on a sale, e.g. an external payment reference for reconciliation. Max 500 characters; the server strips control characters and trims surrounding whitespace, and normalizes an empty result to "no comment". It is purely internal: it is **never** printed on the buyer's receipt and **never** sent to the tax authority (SRC). Omit the field (or send an empty string) for no comment.

  ```ts
  await vcr.registerSale({
    cashier: { id: 1 },
    items: [{ offer: { id: 5 }, department: { id: 1 }, quantity: "1", price: "4000", unit: "pc" }],
    amount: { cash: "4000" },
    comment: "Stripe pi_3Qc...",
  });
  ```

- **`SaleDetail.comment: string | null`** — `getSale(id)` now returns the sale's comment (or `null` when none was set), so an integration can read back the reference it attached.

## [0.15.0] — 2026-07-09

Fixes the foreign-currency request contract, which 0.14.0 modeled incorrectly, and closes the last two gaps against `/api/v1` (`autoSettle` and `GET /exchange-rate`).

### Fixed — foreign-currency contract (breaking, but 0.14.0's shape never worked)

- **Removed `RegisterSaleInput.currencyConversion` and the `CurrencyConversionInput` type.** The API never accepted a top-level `currencyConversion` block — `POST /sales` silently stripped it, so a "foreign-currency" sale sent via 0.14.0 was fiscalized with no HO-234-N conversion trail at all. The real contract is **per-item**: set `SaleItem.currency` (ISO 4217, e.g. `"USD"`) and denominate that item's `price` in the foreign currency; VCR converts every line to AMD server-side at the previous-business-day CBA rate. All foreign-priced items in one sale must share one currency, and mixing AMD with foreign lines is rejected.

  ```diff
  - items: [{ offer: { id: 5 }, department: { id: 1 }, quantity: "1", price: "4000", unit: "pc" }],
  - currencyConversion: { currency: "USD", ratePerUnit: "400", rateDate: "2026-07-07", lines: [{ foreignUnitPrice: "10" }] },
  - amount: { cash: "4000" },
  + items: [{ offer: { id: 5 }, department: { id: 1 }, quantity: "1", price: "10", currency: "USD", unit: "pc" }],
  + autoSettle: { tender: "cash" },
  ```

### Added

- `SaleItem.currency?: string` — per-item ISO 4217 input currency (see above). Omit or `"AMD"` for a native AMD line.
- `RegisterSaleInput.autoSettle?: { tender: "cash" | "nonCash" }` — derived-total payment: VCR computes the AMD cart total and charges the whole of it to one tender. A sale now carries **exactly one** of `amount` (explicit AMD) or `autoSettle`; the types enforce the XOR, mirroring the server's cross-field validation. The essential companion to foreign-currency sales, where the AMD total is not knowable client-side. New exported types `AutoSettle`, `SalePayment`.
- `getExchangeRate({ currency })` — wraps `GET /exchange-rate`. Previews the AMD conversion rate VCR would apply to a foreign-currency sale registered now (CBA mid-market rate, previous business day, HO-234-N). Read-only; rejects `AMD`. New type `ExchangeRate`, new schema `exchangeRateResponseSchema`.

### Changed

- `RegisterSaleInput.amount` is no longer required on its own — it is one arm of the `amount` / `autoSettle` union. Existing `{ ..., amount }` call sites are unaffected.
- Dev tooling patch bumps (`@tsconfig/node24`, `@tsconfig/strictest`, `vite`). No change to the published package. TypeScript 7, pnpm 11, and `@types/node` 26 are available but intentionally deferred (kept aligned with the platform monorepo, which pins TypeScript 5.9).

## [0.14.0] — 2026-07-08

Closes the drift that had accumulated against `/api/v1` since 0.13.0. Everything here is additive — no call-site changes required.

### Added

- `whoami()` — wraps `GET /whoami`. Returns `{ vcrId, crn, mode, tradingPlatformName, businessEntity }`, where `mode` is `"production"` / `"sandbox"` and `crn` is `null` for imported-but-not-yet-activated VCRs. Useful as a cheap SDK health-check and for telling production keys apart from sandbox ones. New type `Whoami`, new schema `whoamiResponseSchema`.
- `listOffers({ externalId?, type?, includeArchived? })` — wraps `GET /offers`. Returns up to 500 `OfferListItem[]`. Check whether an offer already exists (by `externalId`) before creating it.
- `getOffer(id)` — wraps `GET /offers/{id}`. Returns a single `OfferListItem`.
- `updateOffer(id, { title })` — wraps `PATCH /offers/{id}`. Renames an offer's title going forward; already-issued receipts and the SRC fiscal record are unchanged. Accepts the canonical `OfferTitle` (`localized` / `universal`).
- New types `OfferListItem`, `ListOffersFilter`, `UpdateOfferInput`, `CurrencyConversionInput`; new schemas `offerListItemSchema`, `offerListResponseSchema`.
- `RegisterSaleInput.currencyConversion?` — foreign-currency sales (HO-234-N). Enter the sale in USD/EUR/RUB etc.; VCR converts to AMD at the previous-business-day CBA rate and rejects a stale rate. The AMD `price` values in `items[]` stay authoritative.
- `SaleItem.emarks?: string[]` — per-line eMark codes for marked goods (Govt Decision 1976-N). Previously only refund items could carry eMarks.
- `Offer` (sale-item offer) gained the by-internal-id reference shape `{ id: number }`, alongside the existing new-offer and `{ externalId }` shapes.
- `VCRApiError.body.requestId` — the server's 5xx correlation ID is now preserved instead of being stripped. Include it when contacting support.

### Changed

- `CreateOfferInput.title` now also accepts the canonical `OfferTitle` shape (`{ type: "localized" | "universal", ... }`), unifying it with inline sale offers and `updateOffer`, and unlocking `universal` (brand-name) titles. The legacy `{ value, localizationStrategy }` shape (now typed as `LegacyOfferTitle`) still works but is **deprecated** — the server plans to drop it.
- Dependency refresh: `zod` `^4.4.1` → `^4.4.3`. Dev tooling bumped (`vite` `^8.0.10` → `^8.1.3`, clearing two Windows-only dev-server advisories; `@biomejs/biome`, `vitest`, `@vitest/coverage-v8`, `publint`, `@arethetypeswrong/cli`). An `esbuild` `>=0.28.1` override clears a low-severity build-time advisory. None of these ship in the published package.

## [0.13.0] — 2026-05-27

### Added

- `listDepartments()` — wraps `GET /departments`. Returns `DepartmentListItem[]` with `internalId`, `externalId`, `taxRegime`, and the localized `title`. Only departments confirmed by the tax service are included, so each `internalId` is safe to reference from a sale item's `department.id`. Closes the gap where the SDK could create departments but not list them.
- New exported types: `DepartmentListItem`. New exported schemas: `departmentListItemSchema`, `departmentListResponseSchema`.

## [0.12.0] — 2026-05-26

### Added

- `listPrepayments({ customerRef?, state? })` — wraps `GET /prepayments`. Returns up to 500 rows; each item carries the ledger-derived `remaining` and `state` (`open` / `consumed` / `refunded`). `state: "all"` is accepted as an explicit no-op filter.
- `getCustomerPrepaymentBalance({ customerRef })` — wraps `GET /prepayments/balance`. Returns the open balance for that customer, scoped to the BusinessEntity that owns the calling VCR's API key, plus the FIFO-ordered list of contributing open prepayments.
- New exported types: `PrepaymentListItem`, `PrepaymentState`, `CustomerPrepaymentBalance`, `ListPrepaymentsFilter`. New exported schemas: `prepaymentListItemSchema`, `prepaymentListResponseSchema`, `prepaymentStateSchema`, `customerPrepaymentBalanceResponseSchema`.

### Changed

- `PrepaymentDetail` (the `getPrepayment` response) now includes `remaining: number` and `state: PrepaymentState`. The server has been sending these since the ledger landed; the SDK schema is catching up. Strictly additive — existing consumers keep working.

## [0.11.0] — 2026-05-13

### Breaking

- `CreateDepartmentInput` now requires `title: { value: LocalizedName; localizationStrategy }` (mirroring `CreateCashierInput.name` and `CreateOfferInput.title`). `value.hy` is required, `value.ru`/`value.en` are optional. The server-side endpoint previously persisted departments without a title, which crashed X/Z reports for any sale that referenced one — the 0.10.0 call shape (`{ taxRegime, externalId? }`) is no longer accepted. Update calls to:

  ```ts
  await client.createDepartment({
    taxRegime: "vat",
    title: {
      value: { hy: "Մթերք", ru: "Продукты", en: "Groceries" },
      localizationStrategy: "translation",
    },
  });
  ```

## [0.10.0] — 2026-05-02

### Breaking

- `SaleAmount.prePayment` was renamed to `prepayment`. The 0.8.0 spelling was a silent bug — the server only accepted `prepayment`, so any consumer using `prePayment` was sending an unrecognized field that the server ignored. If your code referenced `prePayment`, update it.
- The `searchClassifierCategory` method now hits `/searchByClassifier` (the actual API path) instead of `/searchClassifier`. The 0.8.0 path returned 404 against production, so any working consumer can't have been using it.
- The `simple-typed-fetch` runtime dependency is removed. Errors thrown by the SDK now extend the new `VCRError` hierarchy (`VCRApiError`, `VCRValidationError`, `VCRNetworkError`) instead of whatever shape `simple-typed-fetch` produced. Update `catch` blocks accordingly.
- `./browser` subpath export was removed from `package.json`. The IIFE bundle is still shipped at `lib/index.global.js` and remains usable via `<script src="https://unpkg.com/@blob-solutions/vcr-am-sdk/lib/index.global.js">`.

### Added

- Full coverage of the public `/api/v1` surface: `getSale`, `registerSaleRefund`, `registerPrepayment`, `getPrepayment`, `registerPrepaymentRefund`, `listCashiers`, `createCashier`, `createOffer`, `createDepartment`. Existing `registerSale` and `searchClassifierCategory` retained.
- Structured error classes: `VCRError` (abstract base), `VCRApiError`, `VCRValidationError`, `VCRNetworkError`. All carry `url`, `status` (where applicable), and the original Zod issues / cause.
- Configurable client: `VCRClientOptions` exposes `baseUrl`, `fetch`, and `timeoutMs`. Per-request `RequestOptions` adds `signal` and `timeoutMs`.
- Schema-validated responses for every endpoint (Zod 4). Response shape changes will fail loudly with `VCRValidationError` instead of silently returning broken data.
- 44-test Vitest suite, 100% line/function coverage, `publint` and `attw` checks in `prepublishOnly`.

### Changed

- Native `fetch` and `AbortSignal` used directly — no polyfill, no wrapper library.
- The whole request flow (connect → body read → schema parse) is bounded by a single timer; previously the timer was cleared as soon as headers arrived, leaving body reads unbounded.
- `Zod` upgraded `^3.24.1` → `^4.4.1`.
- `TypeScript` upgraded `^5.7.2` → `^5.9.3`.
- Minimum Node version raised to `>=22.12.0`.
- `package.json` exports map split for proper dual ESM/CJS types resolution (`.d.ts` for `import`, `.d.cts` for `require`); validated by `publint` and `attw`.

### Removed

- `simple-typed-fetch` and `type-fest` runtime dependencies.

## [0.8.0] and earlier

Not retroactively documented. See git history.
