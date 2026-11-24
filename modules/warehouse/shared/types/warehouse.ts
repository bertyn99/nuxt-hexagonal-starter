export type HandlingClassDto = 'STANDARD' | 'FRAGILE' | 'COLD_CHAIN' | 'HAZMAT'
export type StorageZoneDto = 'AMBIENT' | 'COLD_CHAIN' | 'HAZMAT'
export type StoredCargoStatusDto = 'AVAILABLE' | 'ALLOCATED'

export interface StoredCargoDto {
  cargoId: string
  kind: 'PARCEL' | 'PALLET'
  sku: string
  label: string
  handlingClass: HandlingClassDto
  weightKg: number
  volumeM3: number
  itemCount: number
  status: StoredCargoStatusDto
  allocatedShipmentId: string | null
  storedAt: string
}

export interface WarehouseBinDto {
  id: string
  code: string
  zone: StorageZoneDto
  maxWeightKg: number
  usedWeightKg: number
  weightUtilizationPercent: number
  maxVolumeM3: number
  usedVolumeM3: number
  volumeUtilizationPercent: number
  utilizationPercent: number
  cargoCount: number
  storedCargo: StoredCargoDto[]
}

export interface ZoneUtilizationDto {
  zone: StorageZoneDto
  binCount: number
  usedWeightKg: number
  maxWeightKg: number
  usedVolumeM3: number
  maxVolumeM3: number
  utilizationPercent: number
  availableCargoCount: number
  allocatedCargoCount: number
}

export interface WarehouseUtilizationDto {
  totalBins: number
  totalCargoUnits: number
  availableCargoUnits: number
  allocatedCargoUnits: number
  overallUtilizationPercent: number
  binsNearCapacity: number
  byZone: ZoneUtilizationDto[]
}
