# ADR-005: Authentication & RBAC Across Hexagonal Boundaries

## Status

Accepted

## Context

Most production Nuxt applications require Authentication (AuthN) and Role-Based Access Control (RBAC), yet auth libraries are one of the fastest ways to leak framework dependencies into a hexagonal core (`getUserSession`, `better-auth` DB tables, or H3 events creeping into use cases and domain entities).

We evaluated two primary approaches in the Nuxt 4 ecosystem:

1. **`nuxt-auth-utils` + `nuxt-authorization`** (lightweight stateless encrypted cookie sessions + isomorphic ability guards).
2. **`better-auth`** (batteries-included auth framework with DB-backed sessions, OAuth, organizations/multi-tenancy, and built-in RBAC plugins).

## Decision

1. **Real implementation in this template: `nuxt-auth-utils` + `nuxt-authorization` isolated inside `modules/auth/`.**
   - `nuxt-auth-utils` uses stateless encrypted cookies, preserving zero-friction dual persistence (`in-memory` and `drizzle-sqlite`) without forcing auth schema migrations on first boot.
   - `nuxt-authorization` bridges the authenticated session to isomorphic UI components (`<Can>`, `<Cannot>`) and server helpers (`allows`, `authorize`).
   - `modules/auth/` owns credential verification (`AuthenticateUserUseCase`), `UserAccount` domain invariants, dual persistence (`InMemory` + `DrizzleSqlite` with shared contract tests), `/login`, and dev/inspector-only persona switching.
2. **Framework-agnostic kernel primitives in `modules/hexagonal-kernel/core/`.**
   - `Actor`, `Role`, `SYSTEM_ACTOR`, `ANONYMOUS_ACTOR`, `UnauthorizedError` (401), `ForbiddenError` (403), `ExecutionContext`, and `AuthorizingUseCaseDecorator`.
   - `UseCase.execute(input, ctx?)` accepts an explicit `ExecutionContext` so singleton DI containers stay singletons without `AsyncLocalStorage` magic inside `core/`.
3. **Single source of truth for RBAC policies.**
   - Each bounded context owns its own pure domain policy functions (`modules/warehouse/core/domain/policies/warehouse-access.policy.ts`, `modules/delivery/core/domain/policies/delivery-access.policy.ts`).
   - Both `AuthorizingUseCaseDecorator` (application enforcement) and `nuxt-authorization` `defineAbility` (`modules/<ctx>/shared/abilities/`) call the **exact same pure policy functions**, eliminating permission drift between UI and API.
4. **Documented alternative: `better-auth`.**
   - See [docs/guides/auth-with-better-auth.md](../guides/auth-with-better-auth.md) for a step-by-step guide demonstrating how to swap `modules/auth/`'s session adapter from `nuxt-auth-utils` to `better-auth` without modifying `hexagonal-kernel`, `warehouse`, or `delivery`.

## Consequences

- **Positive:** Pure domain & RBAC unit tests execute in `<100ms` with zero Nuxt boot; deleting `warehouse` or `delivery` automatically deletes its RBAC policies; swapping auth providers is strictly confined to `modules/auth/` and driving-adapter session resolution.
- **Boundary enforcement:** `nuxt-auth-utils`, `nuxt-authorization`, and `better-auth` are explicitly banned inside `modules/*/core/domain/` and `modules/*/core/application/` across all 4 boundary-enforcement layers (`tsconfig.domain.json`, `boundary-checker.ts`, `.oxlintrc.json`, and `test/arch/`).
