# ADR-001: Hexagonal Modular Monolith Using Nuxt 4 Local Modules

## Status

Accepted

## Context

Conventional Nuxt applications organize files by technical layer (`app/components/`, `app/pages/`, `server/api/`, `server/utils/`). As domains grow, business invariants leak into H3 event handlers, Drizzle SQL queries, and Vue components, making domain logic slow to test (requiring full Nuxt/DB boot) and difficult to evolve independently across teams.

## Decision

We combine two complementary architectures natively supported by Nuxt 4:

1. **Modular Monolith via Local Nuxt Modules (`modules/<bounded-context>/index.ts`):**
   - Each Bounded Context (`warehouse`, `delivery`) and the shared platform (`hexagonal-kernel`) is a self-contained vertical slice using `defineNuxtModule` from `@nuxt/kit`.
   - Each module registers its own Nitro routes (`addServerScanDir`), prefixed Vue components (`addComponentsDir`), composables (`addImportsDir`), pages (`extendPages`), and shared DTO/schema TypeScript context (`sharedTsConfig.include`).
2. **Hexagonal Architecture (Ports & Adapters) inside every module:**
   - `core/domain/`: Pure TypeScript only — zero framework, DB, validation library, or Node imports.
   - `core/application/`: Use Cases (`Command`) and Outbound Ports depending exclusively on `core/domain/` and `hexagonal-kernel/core/`.
   - `core/infrastructure/`: Swappable driven adapters (Drizzle SQLite, InMemory, Carrier Gateways, ACL) and DI Composition Root.
   - `shared/`: HTTP DTOs and Zod / Standard Schema validators bridging Nitro and Nuxt UI `<UForm>`.
   - `runtime/server/` & `runtime/app/`: Thin driving adapters (H3 endpoints and Nuxt UI v4 views).

## Consequences

- **Positive:** Domain unit tests execute in `<100ms` in pure Node with zero Nuxt boot; replacing example domains with new contexts requires only deleting `modules/warehouse/` and `modules/delivery/` and dropping in `modules/<your-context>/`.
- **Trade-off:** Requires discipline around layer boundaries, which we automate via 4 enforcement layers (`tsconfig.domain.json`, build-time Nuxt module hook, Oxlint restricted imports, and Vitest import-graph assertions).
