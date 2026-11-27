# ADR-004: Design Patterns Catalog & Anti-Overengineering Guardrails

## Status

Accepted

## Context

Architectural templates often suffer from "pattern bingo" — forcing every Gang of Four pattern into toy code where a simple function or union type would suffice.

## Decision

We apply design patterns **only where concrete domain or architectural pressure justifies them**, and explicitly omit patterns without real pressure:

### Included Patterns (Justified by Domain Pressure)

- **Factory Method:** `UserAccount.create` vs `rehydrate`, `WarehouseBin.create` vs `rehydrate`, and `Shipment.create` vs `rehydrate` enforce invariants on creation while reconstituting DB rows cleanly without spurious events.
- **Abstract Factory:** `*PersistenceAdapterFactory` guarantees coherent repository families (`InMemory` vs `DrizzleSqlite`).
- **Builder:** `WarehouseBinBuilder`, `ParcelBuilder`, and `ShipmentBuilder` in `test/helpers/` keep unit and contract tests concise and expressive.
- **Adapter:** H3 controllers (driving) and Drizzle/InMemory/Scrypt/Carrier/Clock/ACL adapters (driven).
- **Composite:** `CargoUnit` (`Parcel` leaf + `Pallet` composite) recursively aggregates weight, volume, and strictest `HandlingClass`.
- **Decorator:** `AuthorizingUseCaseDecorator` (RBAC policy enforcement) composed inside `TracingUseCaseDecorator` (Architecture Inspector call tracing) wraps any `UseCase<TIn, TOut>` transparently without polluting application logic.
- **Facade:** Module container facades (`useAuthModule`, `useWarehouseModule`, `useDeliveryModule`), `WarehousePublicFacade`, and Nuxt composables (`useAuth`, `useWarehouse`, `useDeliveries`).
- **State:** Explicit `ShipmentState` classes eliminate sprawling `switch/if` transition tables and raise typed `InvalidStateTransitionError` / `CannotCancelDispatchedShipmentError`.
- **Strategy:** `CarrierStrategy` (`StandardGround`, `ExpressAir`, `ColdChainCourier`) encapsulates handling eligibility, pricing, and ETA calculation.
- **Chain of Responsibility:** `StorageAllocationChain` (Zone → Weight → Volume) and `DeliveryExceptionChain` (Attempt 1 Retry → Attempt 2 Hub Hold → Attempt 3 Return).
- **Observer:** Post-commit Domain Events dispatched via `EventBusPort` to `AuditLogSubscriber`, `CarrierWebhookSubscriber`, and cross-context handlers.
- **Command:** Single-purpose `UseCase<Input, Output>` classes accepting an explicit `ExecutionContext` for uniform decorator composition.

### Intentionally Omitted Patterns (Anti-Overengineering)

- **UnitOfWorkPort:** Synchronous `better-sqlite3` Drizzle transactions do not support `async` callbacks across async repository ports, and cross-context operations should use compensating actions (see ADR-003) rather than shared DB transactions.
- **Flyweight:** No high-cardinality identical immutable objects causing memory pressure.
- **Visitor:** Domain hierarchies (`CargoUnit`, `ShipmentState`) are small and closed; polymorphism is clearer than double dispatch.
- **Bridge:** Ports & Adapters already decouple abstraction from implementation.
- **Global Singleton inside `core/`:** Strictly forbidden; dependencies are injected via constructors so unit tests run isolated and deterministic.
