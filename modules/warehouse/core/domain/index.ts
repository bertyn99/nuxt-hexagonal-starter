export { Weight } from './value-objects/weight'
export { Dimensions, Volume } from './value-objects/dimensions'
export { STORAGE_ZONES, assertStorageZone, isHandlingCompatibleWithZone } from './value-objects/storage-zone'
export type { StorageZone } from './value-objects/storage-zone'
export { Parcel, Pallet, rehydrateCargoUnit } from './entities/cargo-unit'
export type { CargoUnit, CargoUnitSnapshot, ParcelSnapshot, PalletSnapshot } from './entities/cargo-unit'
export { WarehouseBin, BIN_UTILIZATION_THRESHOLD_PERCENT } from './entities/warehouse-bin'
export type { StoredCargoEntry, StoredCargoEntrySnapshot, StoredCargoStatus, WarehouseBinProps } from './entities/warehouse-bin'
export {
  createStorageAllocationChain,
  ZoneCompatibilityHandler,
  WeightCapacityHandler,
  VolumeCapacityHandler,
} from './policies/storage-allocation-chain'
export type { StorageAllocationContext, StorageAllocationHandler } from './policies/storage-allocation-chain'
export * from './events/warehouse.events'
export * from './errors/warehouse.errors'
