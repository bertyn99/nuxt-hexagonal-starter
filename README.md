# Nuxt 4 Hexagonal Modular Monolith Template (Logistics: Storage & Delivery)

A production-grade **Nuxt 4** repository template demonstrating **Hexagonal Architecture (Ports & Adapters)** combined with a **Modular Monolith** built natively on **Local Nuxt Modules (`modules/*/`)**, **Nuxt UI v4**, **Drizzle ORM (SQLite)**, **Zod**, **Auth + RBAC (`nuxt-auth-utils` + `nuxt-authorization`)**, and **4-layer automated boundary enforcement**.

## Architectural Highlights

- **Modular Monolith via Local Nuxt Modules:**
  - `modules/hexagonal-kernel/` — Reusable platform kernel (Domain primitives, `Actor`, `ExecutionContext`, `ClockPort`, `EventBusPort`, `AuditLogPort`, `TracingUseCaseDecorator`, `AuthorizingUseCaseDecorator`, dynamic error-guidance registry, SQLite driver, build-time boundary guard, and Architecture Inspector drawer).
  - `modules/auth/` — **Supporting Context (IAM: Auth & RBAC):** `UserAccount` domain entity, `AuthenticateUserUseCase`, scrypt password hashing, dual persistence (`InMemory` & `DrizzleSqlite`), `nuxt-auth-utils` encrypted cookie sessions, `nuxt-authorization` isomorphic abilities, `/login` UI, and dev/inspector persona switcher.
  - `modules/warehouse/` — **Bounded Context A (WMS Storage):** `WarehouseBin` aggregate, Composite `CargoUnit` (`Parcel` + `Pallet`), `StorageAllocationChain` (Zone → Weight → Volume), pure RBAC policies, dual persistence (`InMemory` & `DrizzleSqlite`), Nitro API, and `/warehouse` UI.
  - `modules/delivery/` — **Bounded Context B (TMS Dispatch):** `Shipment` State Machine, `CarrierStrategy` (Ground / Air / Cold-Chain), `DeliveryExceptionChain` (3-attempt return), Anti-Corruption Layer (`LocalWarehouseStockAdapter`) with compensating rollback, pure RBAC policies, Nitro API, and `/deliveries` UI.
- **Single-Source-of-Truth RBAC:**
  - Pure domain access policies (`canReceiveWarehouseCargo`, `canCreateShipment`, etc.) are shared by both `AuthorizingUseCaseDecorator` (API/application enforcement returning `401`/`403`) and `nuxt-authorization` `<Can>` / `<Cannot>` UI components.
  - Want **Better Auth** (DB sessions, OAuth, Organizations)? Follow [docs/guides/auth-with-better-auth.md](docs/guides/auth-with-better-auth.md) to swap `modules/auth/` without touching `hexagonal-kernel`, `warehouse`, or `delivery`.
- **4-Layer Automated Architecture Enforcement:**
  1. **Compile-time (`tsconfig.domain.json`):** Isolated TypeScript config with `"types": []` covering `modules/*/core/domain/**/*.ts` — ambient Nuxt/Node/DOM globals fail `tsc` immediately.
  2. **Build/Dev-time:** `modules/hexagonal-kernel/index.ts` validates boundaries during `nuxt prepare` and `builder:watch`.
  3. **Lint-time (`.oxlintrc.json`):** Oxlint `no-restricted-imports` rules enforcing inward-only dependencies and cross-context isolation.
  4. **Test-time (`test/arch/`):** Vitest static import-graph assertions executed in CI.
- **Live Architecture Inspector (`USlideover`):**
  - Switch RBAC personas (`Admin`, `Warehouse Operator`, `Dispatcher`, `Viewer`) in development/inspector mode.
  - Inspect wired adapters & registered local modules.
  - Time-travel via `VirtualClockAdapter` (`+2h`, `+12h`, `+1d`, `Reset`, admin-only) and trigger **Evaluate SLAs** to watch `DeliverySlaBreached` fire live.
  - Inject simulated outages/delays into `SimulatedCarrierGatewayAdapter` (admin-only).
  - Inspect real-time layer-by-layer execution traces (including `RBAC Guard` steps) captured by `TracingUseCaseDecorator`.

## Using This Template

When you click **"Use this template"**:

- **Keep:** `modules/hexagonal-kernel/`, `modules/auth/` (or swap to Better Auth), `app/`, `tsconfig.domain.json`, `vitest.config.ts`, `test/arch/`, `docs/adr/`, `.github/workflows/ci.yml`.
- **Delete or replace:** `modules/warehouse/` and `modules/delivery/` — scaffold new contexts with:

```bash
pnpm new:context billing
```

## Quick Start

```bash
pnpm install
pnpm dev
```

Seeded demo accounts (password: `hexlogix-demo`, or use the 1-click persona switcher in the sidebar / `/login`):

- `admin@hexlogix.dev` (`admin`) — Full WMS + TMS + Inspector controls
- `warehouse@hexlogix.dev` (`warehouse_operator`) — Warehouse writes, read-only Delivery
- `dispatcher@hexlogix.dev` (`dispatcher`) — Delivery writes & ACL allocation, read-only Warehouse
- `viewer@hexlogix.dev` (`viewer`) — Read-only across all contexts

For production, set `NUXT_APP_SECRET` (generate with `openssl rand -base64 32`; see `.env.example`). `hexagonal.inspector` automatically defaults to `false` when `NODE_ENV=production`.

Configure adapters in `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  hexagonal: {
    persistence: 'drizzle-sqlite', // 'in-memory' | 'drizzle-sqlite'
    carrier: 'simulated', // 'simulated' | 'webhook-console'
    clock: 'virtual', // 'system' | 'virtual'
    inspector: true, // defaults to NODE_ENV !== 'production'
    sqlitePath: '.data/logistics.sqlite',
  },
})
```

## Verification Commands

```bash
# Typecheck Nuxt app/server + pure domain isolation (types: [])
pnpm typecheck

# Lint including architectural import boundary rules
pnpm lint

# Run all Vitest projects (unit, integration, arch, nuxt, e2e)
pnpm test

# Run individual test suites
pnpm test:unit         # Pure domain, RBAC policies & use cases (<100ms, Node)
pnpm test:integration  # Shared Port Contract Tests (InMemory + DrizzleSqlite)
pnpm test:arch         # Hexagonal + Cross-Context import-graph assertions
pnpm test:nuxt         # Module registration & Nuxt UI schema tests
pnpm test:e2e          # Real Nitro HTTP + SSR + RBAC end-to-end flow

# Production build
pnpm build
```

## Architecture Decision Records & Guides

- [ADR-001: Hexagonal Modular Monolith in Nuxt 4](docs/adr/001-hexagonal-modular-monolith-in-nuxt-4.md)
- [ADR-002: Dual Persistence & Port Contract Tests](docs/adr/002-dual-persistence-and-port-contract-tests.md)
- [ADR-003: Cross-Context Communication via ACL & Domain Events](docs/adr/003-cross-context-communication-acl-and-events.md)
- [ADR-004: Design Patterns & Anti-Overengineering](docs/adr/004-design-patterns-and-anti-overengineering.md)
- [ADR-005: Authentication & RBAC Across Hexagonal Boundaries](docs/adr/005-authentication-and-rbac-boundaries.md)
- [Guide: Swapping Auth to Better Auth](docs/guides/auth-with-better-auth.md)
