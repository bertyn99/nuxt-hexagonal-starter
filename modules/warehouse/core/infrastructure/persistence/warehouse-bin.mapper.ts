import { WarehouseBin } from '../../domain/entities/warehouse-bin'
import type { StoredCargoEntrySnapshot } from '../../domain/entities/warehouse-bin'
import type { StorageZone } from '../../domain/value-objects/storage-zone'

export interface WarehouseBinPersistenceRecord {
  id: string
  code: string
  zone: StorageZone
  maxWeightKg: number
  maxVolumeM3: number
  storedEntriesJson: string
}

export function toWarehouseBinRecord(bin: WarehouseBin): WarehouseBinPersistenceRecord {
  const snapshot = bin.toSnapshot()
  return {
    id: snapshot.id,
    code: snapshot.code,
    zone: snapshot.zone,
    maxWeightKg: snapshot.maxWeightKg,
    maxVolumeM3: snapshot.maxVolumeM3,
    storedEntriesJson: JSON.stringify(snapshot.storedEntries),
  }
}

export function fromWarehouseBinRecord(record: WarehouseBinPersistenceRecord): WarehouseBin {
  const storedEntries = JSON.parse(record.storedEntriesJson) as StoredCargoEntrySnapshot[]
  return WarehouseBin.rehydrate({
    id: record.id,
    code: record.code,
    zone: record.zone,
    maxWeightKg: record.maxWeightKg,
    maxVolumeM3: record.maxVolumeM3,
    storedEntries,
  })
}
