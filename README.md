# Nuxt 4 Hexagonal Modular Monolith Template (Logistics: Storage & Delivery)

A production-grade **Nuxt 4** repository template demonstrating **Hexagonal Architecture (Ports & Adapters)** combined with a **Modular Monolith** built natively on **Local Nuxt Modules (`modules/*/`)**, **Nuxt UI v4**, **Drizzle ORM (SQLite)**, **Zod**, **evlog**, **Auth + RBAC (`nuxt-auth-utils` + `nuxt-authorization`)**, and **4-layer automated boundary enforcement**.

## Architectural Highlights

- **Modular Monolith via Local Nuxt Modules:**
  - `modules/hexagonal-kernel/` — Reusable, domain-agnostic platform kernel (`DomainError`, `Entity`, `Actor`, `ExecutionContext`, `ClockPort`, `EventBusPort`, `AuditLogPort`, `AuthorizingUseCaseDecorator`, `TracingUseCaseDecorator`, pluggable `actor-context` resolver, dynamic error-guidance registry, SQLite driver, build-time boundary guard, and slot-based Architecture Inspector drawer).
  - `modules/auth/` — **Supporting Context (IAM: Auth & RBAC):** `UserAccount` domain entity, timing-safe `AuthenticateUserUseCase`, scrypt password hashing (unique salt per user), dual persistence (`InMemory` & `DrizzleSqlite`), `nuxt-auth-utils` encrypted cookie sessions (`NUXT_APP_SECRET`), `nuxt-authorization` isomorphic abilities, `/login` UI, and inspector-gated persona switcher.
  - `modules/warehouse/` — **Bounded Context A (WMS Storage):** `WarehouseBin` aggregate, Composite `CargoUnit` (`Parcel` + `Pallet`), `StorageAllocationChain` (Zone → Weight → Volume), pure RBAC policies + UI abilities, dual persistence (`InMemory` & `DrizzleSqlite`), Nitro API, and `/warehouse` UI.
  - `modules/delivery/` — **Bounded Context B (TMS Dispatch):** `Shipment` State Machine, `CarrierStrategy` (Ground / Air / Cold-Chain), `DeliveryExceptionChain` (3-attempt return), Anti-Corruption Layer (`LocalWarehouseStockAdapter`) with compensating rollback, pure RBAC policies + UI abilities, Nitro API, and `/deliveries` UI.

```text
modules/
├── hexagonal-kernel/   # Platform kernel (NEVER imports sibling contexts — enforced by KERNEL_ISOLATION)
├── auth/               # IAM supporting context (registers actor resolver into kernel at Nitro startup)
├── warehouse/          # WMS bounded context (depends only on hexagonal-kernel)
└── delivery/           # TMS bounded context (depends on hexagonal-kernel + WarehousePublicFacade via ACL)
```

- **Single-Source-of-Truth RBAC & Swappable Auth:**
  - Pure domain access policies (`canReceiveWarehouseCargo`, `canReleaseWarehouseCargo`, `canCreateShipment`, `canManageShipmentLifecycle`, `canEvaluateDeliverySlas`) are shared by both `AuthorizingUseCaseDecorator` (API/application enforcement returning `401`/`403`) and `nuxt-authorization` `<Can>` / `<Cannot>` UI guards across pages, cards, and table rows.
  - `modules/auth/` registers its session resolver into `modules/hexagonal-kernel/runtime/server/utils/actor-context.ts` at Nitro startup (`registerActorResolver`), so `hexagonal-kernel`, `warehouse`, and `delivery` have **zero direct imports from `modules/auth/`**.
  - Want **Better Auth** (DB sessions, OAuth, Passkeys, Organizations)? Follow [docs/guides/auth-with-better-auth.md](docs/guides/auth-with-better-auth.md) to swap `modules/auth/` without touching `hexagonal-kernel`, `warehouse`, or `delivery`.
- **4-Layer Automated Architecture Enforcement:**
  1. **Compile-time (`tsconfig.domain.json`):** Isolated TypeScript config with `"types": []` covering `modules/*/core/domain/**/*.ts` — ambient Nuxt/Node/DOM globals fail `tsc` immediately.
  2. **Build/Dev-time:** `modules/hexagonal-kernel/index.ts` validates `DOMAIN_PURITY`, `APPLICATION_ISOLATION`, `KERNEL_ISOLATION`, and `CROSS_CONTEXT_ISOLATION` during `nuxt prepare` and `builder:watch`.
  3. **Lint-time (`.oxlintrc.json`):** Oxlint `no-restricted-imports` rules enforcing inward-only dependencies, kernel isolation, and cross-context isolation.
  4. **Test-time (`test/arch/`):** Vitest static import-graph assertions executed in CI (`.github/workflows/ci.yml`).
- **Live Architecture Inspector (`USlideover`):**
  - Eagerly lists all registered bounded contexts (`auth`, `warehouse`, `delivery`) on cold boot via each module's Nitro startup plugin.
  - Switch RBAC personas (`Admin`, `Warehouse Operator`, `Dispatcher`, `Viewer`) in development/inspector mode.
  - Time-travel via `VirtualClockAdapter` (`+2h`, `+12h`, `+1d`, `Reset`, admin-only) and trigger **Evaluate SLAs** to watch `DeliverySlaBreached` fire live.
  - Inject simulated outages/delays into `SimulatedCarrierGatewayAdapter` (admin-only).
  - Inspect real-time layer-by-layer execution traces (including accurate `RBAC Guard` pass/rejection steps) captured by `TracingUseCaseDecorator`.

## Using This Template

When you click **"Use this template"**:

- **Keep:** `modules/hexagonal-kernel/`, `modules/auth/` (or swap to Better Auth), `app/`, `tsconfig.domain.json`, `vitest.config.ts`, `test/arch/`, `docs/adr/`, `.github/workflows/ci.yml`, `scripts/new-context.mjs`.
- **Delete or replace:** `modules/warehouse/` and `modules/delivery/` — scaffold new bounded contexts with:

```bash
pnpm new:context billing
```

## Quick Start

Requires **Node.js 22+** and **pnpm 12** (native build allow-list is configured in `pnpm-workspace.yaml`).

```bash
pnpm install
pnpm dev
```

When `hexagonal.inspector` is enabled (`NODE_ENV !== 'production'`), 4 demo accounts are seeded automatically (password: `hexlogix-demo`, or use the 1-click persona switcher in the sidebar / `/login` / Inspector):

- `admin@hexlogix.dev` (`admin`) — Full WMS + TMS + Inspector controls
- `warehouse@hexlogix.dev` (`warehouse_operator`) — Warehouse writes, read-only Delivery
- `dispatcher@hexlogix.dev` (`dispatcher`) — Delivery writes & ACL allocation, read-only Warehouse
- `viewer@hexlogix.dev` (`viewer`) — Read-only across all contexts

### Production Security Defaults

- Set `NUXT_APP_SECRET` (at least 32 characters; generate with `openssl rand -base64 32`; see `.env.example`) for `nuxt-auth-utils` cookie sealing (`nuxt-auth-session`).
- `hexagonal.inspector` defaults to `process.env.NODE_ENV !== 'production'`. In production (`inspector: false`):
  - `/api/_hexagonal/*`, `/api/auth/personas`, and `/api/auth/switch-persona` return `404 INSPECTOR_DISABLED`.
  - Demo accounts are **not** auto-seeded and `/login` does **not** pre-fill demo credentials or show the demo persona switcher.
  - Inspector navigation items and quick actions are hidden from the UI.

Configure adapters in `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  hexagonal: {
    persistence: 'drizzle-sqlite', // 'in-memory' | 'drizzle-sqlite'
    carrier: 'simulated', // 'simulated' | 'webhook-console'
    clock: 'virtual', // 'system' | 'virtual'
    inspector: process.env.NODE_ENV !== 'production',
    sqlitePath: '.data/logistics.sqlite',
  },
})
```

## Verification Commands

All checks below run automatically on push/PR via `.github/workflows/ci.yml`:

```bash
# Typecheck Nuxt app/server + pure domain isolation (types: [])
pnpm typecheck

# Lint including architectural import boundary rules (Oxlint)
pnpm lint

# Check code formatting (Oxfmt)
pnpm format:check

# Run all Vitest projects (unit, integration, arch, nuxt, e2e)
pnpm test

# Run individual test suites
pnpm test:unit         # Pure domain, RBAC policies, decorators & use cases (<100ms, Node)
pnpm test:integration  # Shared Port Contract Tests (InMemory + DrizzleSqlite)
pnpm test:arch         # Hexagonal, Kernel Isolation & Cross-Context import-graph assertions
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
