import { and, desc, eq } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import type { DrizzleSqliteDriver } from '../../../../../hexagonal-kernel/core/infrastructure/persistence/drizzle-sqlite-driver'
import type {
  ShipmentFilter,
  ShipmentRepositoryPort,
} from '../../../application/ports/outbound/shipment-repository.port'
import type { Shipment } from '../../../domain/entities/shipment'
import type { CarrierMode } from '../../../domain/policies/carrier-strategy'
import type { ShipmentStateName } from '../../../domain/states/shipment-state'
import { fromShipmentRecord, toShipmentRecord } from '../shipment.mapper'
import { deliveryShipmentsTable } from './delivery.schema'

export class DrizzleSqliteShipmentRepository implements ShipmentRepositoryPort {
  constructor(private readonly driver: DrizzleSqliteDriver) {
    this.ensureSchema()
  }

  ensureSchema(): void {
    this.driver.execDDL(`
      CREATE TABLE IF NOT EXISTS delivery_shipments (
        id TEXT PRIMARY KEY,
        tracking_number TEXT NOT NULL UNIQUE,
        origin_bin_id TEXT NOT NULL,
        origin_bin_code TEXT NOT NULL,
        cargo_summary_json TEXT NOT NULL,
        destination TEXT NOT NULL,
        carrier_mode TEXT NOT NULL,
        carrier_reference TEXT,
        quoted_cost_cents INTEGER NOT NULL,
        currency TEXT NOT NULL,
        promised_by_iso TEXT NOT NULL,
        estimated_hours INTEGER NOT NULL,
        state TEXT NOT NULL,
        attempt_count INTEGER NOT NULL,
        last_exception_note TEXT,
        sla_breached INTEGER NOT NULL,
        created_at_iso TEXT NOT NULL,
        updated_at_iso TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_delivery_shipments_state
        ON delivery_shipments (state, created_at_iso);
    `)
  }

  async findById(id: string): Promise<Shipment | null> {
    const row = this.driver.db
      .select()
      .from(deliveryShipmentsTable)
      .where(eq(deliveryShipmentsTable.id, id))
      .get()

    if (!row) {
      return null
    }
    return fromShipmentRecord({
      ...row,
      carrierMode: row.carrierMode as CarrierMode,
      state: row.state as ShipmentStateName,
    })
  }

  async findByTrackingNumber(trackingNumber: string): Promise<Shipment | null> {
    const upper = trackingNumber.trim().toUpperCase()
    const row = this.driver.db
      .select()
      .from(deliveryShipmentsTable)
      .where(eq(deliveryShipmentsTable.trackingNumber, upper))
      .get()

    if (!row) {
      return null
    }
    return fromShipmentRecord({
      ...row,
      carrierMode: row.carrierMode as CarrierMode,
      state: row.state as ShipmentStateName,
    })
  }

  async findAll(filter?: ShipmentFilter): Promise<Shipment[]> {
    const conditions: SQL[] = []
    if (filter?.state) {
      conditions.push(eq(deliveryShipmentsTable.state, filter.state))
    }
    if (filter?.carrierMode) {
      conditions.push(eq(deliveryShipmentsTable.carrierMode, filter.carrierMode))
    }
    if (filter?.slaBreachedOnly) {
      conditions.push(eq(deliveryShipmentsTable.slaBreached, 1))
    }

    const baseQuery = this.driver.db.select().from(deliveryShipmentsTable)
    const rows = (conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery)
      .orderBy(desc(deliveryShipmentsTable.createdAtIso))
      .all()

    return rows.map(row =>
      fromShipmentRecord({
        ...row,
        carrierMode: row.carrierMode as CarrierMode,
        state: row.state as ShipmentStateName,
      }),
    )
  }

  async save(shipment: Shipment): Promise<void> {
    const record = toShipmentRecord(shipment)
    this.driver.db
      .insert(deliveryShipmentsTable)
      .values(record)
      .onConflictDoUpdate({
        target: deliveryShipmentsTable.id,
        set: {
          carrierReference: record.carrierReference,
          state: record.state,
          attemptCount: record.attemptCount,
          lastExceptionNote: record.lastExceptionNote,
          slaBreached: record.slaBreached,
          updatedAtIso: record.updatedAtIso,
        },
      })
      .run()
  }

  async delete(id: string): Promise<void> {
    this.driver.db.delete(deliveryShipmentsTable).where(eq(deliveryShipmentsTable.id, id)).run()
  }
}
