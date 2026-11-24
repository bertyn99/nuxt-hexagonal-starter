# Nuxt 4 Hexagonal Modular Monolith Template (Logistics: Storage & Delivery)

A production-grade **Nuxt 4** repository template demonstrating **Hexagonal Architecture (Ports & Adapters)** combined with a **Modular Monolith** built natively on **Local Nuxt Modules (`modules/*/`)**, **Nuxt UI v4**, **Drizzle ORM (SQLite)**, **Zod**, and **4-layer automated boundary enforcement**.

## Architectural Highlights

- **Modular Monolith via Local Nuxt Modules:**
  - `modules/hexagonal-kernel/` — Reusable platform kernel (Domain primitives, `ClockPort`, `EventBusPort`, `AuditLogPort`, `TracingUseCaseDecorator`, SQLite driver, build-time boundary guard, and Architecture Inspector drawer).
  - `modules/warehouse/` — **Bounded Context A (WMS Storage):** `WarehouseBin` aggregate, Composite `CargoUnit` (`Parcel` + `Pallet`), `StorageAllocationChain` (Zone → Weight → Volume), dual persistence (`InMemory` & `DrizzleSqlite`), Nitro API, and `/warehouse` UI.
  - `modules/delivery/` — **Bounded Context B (TMS Dispatch):** `Shipment` State Machine, `CarrierStrategy` (Ground / Air / Cold-Chain), `DeliveryExceptionChain` (3-attempt return), Anti-Corruption Layer (`LocalWarehouseStockAdapter`), Nitro API, and `/deliveries` UI.
- **4-Layer Automated Architecture Enforcement:**
  1. **Compile-time (`tsconfig.domain.json`):** Isolated TypeScript config with `"types": []` covering `modules/*/core/domain/**/*.ts` — ambient Nuxt/Node/DOM globals fail `tsc` immediately.
  2. **Build/Dev-time:** `modules/hexagonal-kernel/index.ts` validates boundaries during `nuxt prepare` and `builder:watch`.
  3. **Lint-time (`eslint.config.mjs`):** Restricted import rules enforcing inward-only dependencies and cross-context isolation.
  4. **Test-time (`test/arch/`):** Vitest static import-graph assertions executed in CI.
- **Live Architecture Inspector (`USlideover`):**
  - Inspect wired adapters & registered local modules.
  - Time-travel via `VirtualClockAdapter` (`+2h`, `+12h`, `+1d`, `Reset`) and trigger **Evaluate SLAs** to watch `DeliverySlaBreached` fire live.
  - Inject simulated outages/delays into `SimulatedCarrierGatewayAdapter`.
  - Inspect real-time layer-by-layer execution traces captured by `TracingUseCaseDecorator`.

## Using This Template

When you click **"Use this template"**:
- **Keep:** `modules/hexagonal-kernel/`, `app/`, `tsconfig.domain.json`, `vitest.config.ts`, `test/arch/`, `docs/adr/`.
- **Delete or replace:** `modules/warehouse/` and `modules/delivery/` — add `modules/<your-bounded-context>/` following the same module contract.

## Quick Start

```bash
npm install
npm run dev
```

Configure adapters in `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  hexagonal: {
    persistence: 'drizzle-sqlite', // 'in-memory' | 'drizzle-sqlite'
    carrier: 'simulated',          // 'simulated' | 'webhook-console'
    clock: 'virtual',              // 'system' | 'virtual'
    inspector: true,
    sqlitePath: '.data/logistics.sqlite',
  },
})
```

## Verification Commands

```bash
# Typecheck Nuxt app/server + pure domain isolation (types: [])
npm run typecheck

# Lint including architectural import boundary rules
npm run lint

# Run all Vitest projects (unit, integration, arch, nuxt, e2e)
npm test

# Run individual test suites
npm run test:unit         # Pure domain & use cases (<100ms, Node)
npm run test:integration  # Shared Port Contract Tests (InMemory + DrizzleSqlite)
npm run test:arch         # Hexagonal + Cross-Context import-graph assertions
npm run test:nuxt         # Module registration & Nuxt UI schema tests
npm run test:e2e          # Real Nitro HTTP + SSR end-to-end flow

# Production build
npm run build
```

## Architecture Decision Records

- [ADR-001: Hexagonal Modular Monolith in Nuxt 4](docs/adr/001-hexagonal-modular-monolith-in-nuxt-4.md)
- [ADR-002: Dual Persistence & Port Contract Tests](docs/adr/002-dual-persistence-and-port-contract-tests.md)
- [ADR-003: Cross-Context Communication via ACL & Domain Events](docs/adr/003-cross-context-communication-acl-and-events.md)
- [ADR-004: Design Patterns & Anti-Overengineering](docs/adr/004-design-patterns-and-anti-overengineering.md)
