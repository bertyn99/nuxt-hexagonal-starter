import type { WarehouseBinRepositoryPort } from '../../../application/ports/outbound/warehouse-bin-repository.port'
import type { WarehouseBin } from '../../../domain/entities/warehouse-bin'
import type { StorageZone } from '../../../domain/value-objects/storage-zone'
import { fromWarehouseBinRecord, toWarehouseBinRecord } from '../warehouse-bin.mapper'
import type { WarehouseBinPersistenceRecord } from '../warehouse-bin.mapper'

export class InMemoryWarehouseBinRepository implements WarehouseBinRepositoryPort {
  private readonly records = new Map<string, WarehouseBinPersistenceRecord>()

  async findById(binId: string): Promise<WarehouseBin | null> {
    const record = this.records.get(binId)
    return record ? fromWarehouseBinRecord(record) : null
  }

  async findByCode(code: string): Promise<WarehouseBin | null> {
    const upper = code.trim().toUpperCase()
    for (const record of this.records.values()) {
      if (record.code === upper) {
        return fromWarehouseBinRecord(record)
      }
    }
    return null
  }

  async findByCargoId(cargoId: string): Promise<WarehouseBin | null> {
    for (const record of this.records.values()) {
      const bin = fromWarehouseBinRecord(record)
      if (bin.findCargo(cargoId)) {
        return bin
      }
    }
    return null
  }

  async findAll(filter?: { zone?: StorageZone }): Promise<WarehouseBin[]> {
    const bins = Array.from(this.records.values())
      .filter(record => !filter?.zone || record.zone === filter.zone)
      .sort((a, b) => a.code.localeCompare(b.code))
      .map(fromWarehouseBinRecord)
    return bins
  }

  async save(bin: WarehouseBin): Promise<void> {
    this.records.set(bin.id, toWarehouseBinRecord(bin))
  }

  async delete(binId: string): Promise<void> {
    this.records.delete(binId)
  }

  clear(): void {
    this.records.clear()
  }
}
