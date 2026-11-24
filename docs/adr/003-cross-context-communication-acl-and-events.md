# ADR-003: Cross-Context Communication via Anti-Corruption Layer & Domain Events

## Status

Accepted

## Context

In our Logistics reference domain, `Delivery (TMS)` must inspect and allocate available stock held by `Warehouse (WMS)` when creating a shipment, and `Warehouse` must restock cargo when a shipment is cancelled or returned after 3 failed delivery attempts. Importing `WarehouseBin` or Drizzle tables directly inside `modules/delivery/` would collapse the modular monolith into a distributed-ready-hostile big ball of mud.

## Decision

Bounded contexts (`modules/warehouse/` and `modules/delivery/`) MUST NEVER import each other's `core/domain/` or `core/infrastructure/`. All cross-context collaboration uses two strict patterns:

1. **Synchronous Queries & Commands — Outbound Port + Anti-Corruption Layer (ACL):**
   - `delivery/core/application/ports/outbound/warehouse-stock.port.ts` defines `WarehouseStockPort` in Delivery's own ubiquitous language (`AvailableWarehouseCargo`).
   - `delivery/core/infrastructure/acl/local-warehouse-stock.adapter.ts` implements `WarehouseStockPort` by calling `WarehousePublicFacade` (`modules/warehouse/core/application/warehouse-public.facade.ts`).
2. **Asynchronous Reactions — Domain Events over `EventBusPort`:**
   - When `Shipment` reaches 3 failed delivery attempts, it records `ShipmentReturnedToWarehouse`.
   - `modules/warehouse/` subscribes to `ShipmentReturnedToWarehouse` (and `ShipmentCancelled`) on `EventBusPort` and invokes `ReturnCargoToWarehouseUseCase` to mark the cargo `AVAILABLE` again.

## Consequences

- **Positive:** If `warehouse` is later extracted into a standalone microservice, only `LocalWarehouseStockAdapter` is swapped for an `HttpWarehouseStockAdapter`, and `InProcessEventBusAdapter` is swapped for a message broker (Kafka, NATS, Cloudflare Queues) — zero domain or use-case code changes.
