import type { WarehouseBin } from '../../../domain/entities/warehouse-bin'
import type { StorageZone } from '../../../domain/value-objects/storage-zone'

export interface WarehouseBinRepositoryPort {
  findById(binId: string): Promise<WarehouseBin | null>
  findByCode(code: string): Promise<WarehouseBin | null>
  findByCargoId(cargoId: string): Promise<WarehouseBin | null>
  findAll(filter?: { zone?: StorageZone }): Promise<WarehouseBin[]>
  save(bin: WarehouseBin): Promise<void>
  delete(binId: string): Promise<void>
}
