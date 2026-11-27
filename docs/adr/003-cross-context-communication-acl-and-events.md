# ADR-003: Cross-Context Communication via Anti-Corruption Layer & Domain Events

## Status

Accepted

## Context

In our Logistics reference domain, `Delivery (TMS)` must inspect and allocate available stock held by `Warehouse (WMS)` when creating a shipment, and `Warehouse` must restock cargo when a shipment is cancelled or returned after 3 failed delivery attempts. Meanwhile, `hexagonal-kernel` and all bounded contexts need to resolve the authenticated `Actor` without coupling directly to `modules/auth/`. Importing `WarehouseBin`, `UserAccount`, or Drizzle tables across bounded contexts would collapse the modular monolith into a big ball of mud.

## Decision

Bounded contexts (`modules/auth/`, `modules/warehouse/`, `modules/delivery/`) MUST NEVER import each other's `core/domain/` or `core/infrastructure/`, and `modules/hexagonal-kernel/` MUST NEVER import any sibling bounded context (`KERNEL_ISOLATION`). All cross-context collaboration uses strict patterns:

1. **Synchronous Queries & Commands — Outbound Port + Anti-Corruption Layer (ACL) + Compensating Rollback:**
   - `delivery/core/application/ports/outbound/warehouse-stock.port.ts` defines `WarehouseStockPort` in Delivery's own ubiquitous language (`AvailableWarehouseCargo`), forwarding `ExecutionContext` for cross-context RBAC verification.
   - `delivery/core/infrastructure/acl/local-warehouse-stock.adapter.ts` implements `WarehouseStockPort` by calling `WarehousePublicFacade` (`modules/warehouse/core/application/warehouse-public.facade.ts`).
   - If shipment creation or persistence fails after warehouse cargo allocation, `CreateShipmentFromWarehouseUseCase` invokes `WarehouseStockPort.releaseCargo()` as a best-effort compensating rollback instead of sharing a cross-context database transaction.
2. **Asynchronous Reactions — Domain Events over `EventBusPort`:**
   - When `Shipment` reaches 3 failed delivery attempts, it records `ShipmentReturnedToWarehouse`.
   - `modules/warehouse/` subscribes to `ShipmentReturnedToWarehouse` (and `ShipmentCancelled`) on `EventBusPort` and invokes `ReturnCargoToWarehouseUseCase` with `{ actor: SYSTEM_ACTOR }` to mark the cargo `AVAILABLE` again.
3. **Inversion of Control for Platform Hooks (AuthN & Error Guidance):**
   - `modules/auth/` registers its session-to-`Actor` resolver into `modules/hexagonal-kernel/runtime/server/utils/actor-context.ts` via `registerActorResolver()` at Nitro startup.
   - Each bounded context registers its own domain error guidance into `http-error-mapper.ts` via `registerDomainErrorGuidance()` and its Inspector metadata via a Nitro startup plugin.

## Consequences

- **Positive:** If `warehouse` is later extracted into a standalone microservice, only `LocalWarehouseStockAdapter` is swapped for an `HttpWarehouseStockAdapter`, and `InProcessEventBusAdapter` is swapped for a message broker (Kafka, NATS, Cloudflare Queues) — zero domain or use-case code changes.
- **Positive:** Deleting or replacing `modules/auth/`, `modules/warehouse/`, or `modules/delivery/` never breaks `modules/hexagonal-kernel/`.
