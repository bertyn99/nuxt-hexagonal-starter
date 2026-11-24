import type { ShipmentFilter, ShipmentRepositoryPort } from '../../../application/ports/outbound/shipment-repository.port'
import type { Shipment } from '../../../domain/entities/shipment'
import { fromShipmentRecord, toShipmentRecord } from '../shipment.mapper'
import type { ShipmentPersistenceRecord } from '../shipment.mapper'

export class InMemoryShipmentRepository implements ShipmentRepositoryPort {
  private readonly records = new Map<string, ShipmentPersistenceRecord>()

  async findById(id: string): Promise<Shipment | null> {
    const rec = this.records.get(id)
    return rec ? fromShipmentRecord(rec) : null
  }

  async findByTrackingNumber(trackingNumber: string): Promise<Shipment | null> {
    const upper = trackingNumber.trim().toUpperCase()
    for (const rec of this.records.values()) {
      if (rec.trackingNumber === upper) {
        return fromShipmentRecord(rec)
      }
    }
    return null
  }

  async findAll(filter?: ShipmentFilter): Promise<Shipment[]> {
    return Array.from(this.records.values())
      .filter((rec) => {
        if (filter?.state && rec.state !== filter.state) {
          return false
        }
        if (filter?.carrierMode && rec.carrierMode !== filter.carrierMode) {
          return false
        }
        if (filter?.slaBreachedOnly && !rec.slaBreached) {
          return false
        }
        return true
      })
      .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso))
      .map(fromShipmentRecord)
  }

  async save(shipment: Shipment): Promise<void> {
    this.records.set(shipment.id, toShipmentRecord(shipment))
  }

  async delete(id: string): Promise<void> {
    this.records.delete(id)
  }

  clear(): void {
    this.records.clear()
  }
}
