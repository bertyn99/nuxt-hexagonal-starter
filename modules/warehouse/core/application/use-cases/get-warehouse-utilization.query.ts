import type { UseCase } from '../../../../hexagonal-kernel/core/application/use-case'
import { BIN_UTILIZATION_THRESHOLD_PERCENT, STORAGE_ZONES } from '../../domain'
import type { WarehouseUtilizationView, ZoneUtilizationView } from '../dtos/warehouse.dtos'
import type { WarehouseBinRepositoryPort } from '../ports/outbound/warehouse-bin-repository.port'

export class GetWarehouseUtilizationQuery implements UseCase<void, WarehouseUtilizationView> {
  readonly name = 'GetWarehouseUtilizationQuery'
  readonly boundedContext = 'warehouse'

  constructor(private readonly binRepository: WarehouseBinRepositoryPort) {}

  async execute(): Promise<WarehouseUtilizationView> {
    const bins = await this.binRepository.findAll()

    let totalCargoUnits = 0
    let availableCargoUnits = 0
    let allocatedCargoUnits = 0
    let binsNearCapacity = 0
    let sumUtilization = 0

    const byZone: ZoneUtilizationView[] = STORAGE_ZONES.map(zone => {
      const zoneBins = bins.filter(bin => bin.zone === zone)
      const usedWeightKg = Number(
        zoneBins.reduce((s, b) => s + b.usedWeight.kilograms, 0).toFixed(2),
      )
      const maxWeightKg = Number(zoneBins.reduce((s, b) => s + b.maxWeight.kilograms, 0).toFixed(2))
      const usedVolumeM3 = Number(
        zoneBins.reduce((s, b) => s + b.usedVolume.cubicMeters, 0).toFixed(3),
      )
      const maxVolumeM3 = Number(
        zoneBins.reduce((s, b) => s + b.maxVolume.cubicMeters, 0).toFixed(3),
      )

      const weightPct = maxWeightKg > 0 ? Math.round((usedWeightKg / maxWeightKg) * 100) : 0
      const volumePct = maxVolumeM3 > 0 ? Math.round((usedVolumeM3 / maxVolumeM3) * 100) : 0
      const utilizationPercent = Math.min(100, Math.max(weightPct, volumePct))

      let zoneAvailable = 0
      let zoneAllocated = 0
      for (const bin of zoneBins) {
        if (bin.utilizationPercent >= BIN_UTILIZATION_THRESHOLD_PERCENT) {
          binsNearCapacity += 1
        }
        sumUtilization += bin.utilizationPercent
        for (const entry of bin.storedEntries) {
          totalCargoUnits += 1
          if (entry.status === 'AVAILABLE') {
            availableCargoUnits += 1
            zoneAvailable += 1
          } else {
            allocatedCargoUnits += 1
            zoneAllocated += 1
          }
        }
      }

      return {
        zone,
        binCount: zoneBins.length,
        usedWeightKg,
        maxWeightKg,
        usedVolumeM3,
        maxVolumeM3,
        utilizationPercent,
        availableCargoCount: zoneAvailable,
        allocatedCargoCount: zoneAllocated,
      }
    })

    const overallUtilizationPercent = bins.length > 0 ? Math.round(sumUtilization / bins.length) : 0

    return {
      totalBins: bins.length,
      totalCargoUnits,
      availableCargoUnits,
      allocatedCargoUnits,
      overallUtilizationPercent,
      binsNearCapacity,
      byZone,
    }
  }
}
