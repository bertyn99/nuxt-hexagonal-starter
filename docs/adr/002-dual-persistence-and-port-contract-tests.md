# ADR-002: Dual Persistence Adapters & Shared Port Conformance Contract Tests

## Status

Accepted

## Context

Many "hexagonal" examples define repository interfaces (`*RepositoryPort`) but ship only a single implementation, leaving adapter swappability unproven. Worse, in-memory fakes often diverge subtly from SQL repositories (e.g., returning live object references instead of reconstituted snapshots).

## Decision

1. Every bounded context implements **two full persistence adapter families** behind an **Abstract Factory** (`*PersistenceAdapterFactory`), selectable via `nuxt.config.ts` (`hexagonal.persistence: 'in-memory' | 'drizzle-sqlite'`):
   - `InMemory*Repository`: Deep-clones aggregate snapshots on every `save()` and `find*()` to match database isolation semantics.
   - `DrizzleSqlite*Repository`: Persists aggregates into module-owned SQLite tables via Drizzle ORM (`better-sqlite3`), self-bootstrapping its own table schema via `ensureSchema()`.
2. **Port Conformance Contract Tests** (`test/integration/`) run the **exact same Vitest behavioral suite** against both `InMemory` and `DrizzleSqlite` adapters for `UserAccountRepositoryPort`, `WarehouseBinRepositoryPort`, and `ShipmentRepositoryPort`.

## Consequences

- **Positive:** Behavioral parity between in-memory test doubles and SQLite production adapters is continuously verified in CI.
- **Positive:** Switching storage engines (e.g., to PostgreSQL, Turso/LibSQL, or Cloudflare D1) requires implementing only a new adapter family + factory with zero changes to `core/domain/` or `core/application/`.
