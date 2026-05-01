# Changelog

All notable changes to `@blob-solutions/vcr-am-sdk`. The format is loosely based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows [Semantic Versioning](https://semver.org/).

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
