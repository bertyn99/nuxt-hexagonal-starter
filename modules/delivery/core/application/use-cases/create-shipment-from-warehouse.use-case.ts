import type { ClockPort } from '../../../../hexagonal-kernel/core/application/ports/clock.port'
import type { EventBusPort } from '../../../../hexagonal-kernel/core/application/ports/event-bus.port'
import type {
  ExecutionContext,
  UseCase,
} from '../../../../hexagonal-kernel/core/application/use-case'
import { resolveCarrierStrategy, Shipment } from '../../domain'
import type { CarrierMode } from '../../domain'
import { mapShipmentToView } from '../dtos/delivery.dtos'
import type { ShipmentView } from '../dtos/delivery.dtos'
import type { ShipmentRepositoryPort } from '../ports/outbound/shipment-repository.port'
import type { WarehouseStockPort } from '../ports/outbound/warehouse-stock.port'

export interface CreateShipmentFromWarehouseInput {
  readonly id?: string
  readonly cargoId: string
  readonly destination: string
  readonly carrierMode: CarrierMode
}

let shipmentSeq = 100

function nextShipmentId(): string {
  shipmentSeq += 1
  return `shp_${Date.now().toString(36)}_${shipmentSeq.toString(36)}`
}

export class CreateShipmentFromWarehouseUseCase implements UseCase<
  CreateShipmentFromWarehouseInput,
  ShipmentView
> {
  readonly name = 'CreateShipmentFromWarehouseUseCase'
  readonly boundedContext = 'delivery'

  constructor(
    private readonly shipmentRepository: ShipmentRepositoryPort,
    private readonly warehouseStockPort: WarehouseStockPort,
    private readonly eventBus: EventBusPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(
    input: CreateShipmentFromWarehouseInput,
    ctx?: ExecutionContext,
  ): Promise<ShipmentView> {
    const now = this.clock.now()
    const shipmentId = input.id?.trim() || nextShipmentId()

    // Pre-check carrier strategy eligibility against available stock before mutating warehouse allocation
    const available = await this.warehouseStockPort.listAvailableCargo(ctx)
    const candidate = available.find(item => item.cargoId === input.cargoId)
    if (candidate) {
      const strategy = resolveCarrierStrategy(input.carrierMode)
      strategy.quote({
        weightKg: candidate.weightKg,
        volumeM3: candidate.volumeM3,
        handlingClass: candidate.handlingClass,
      })
    }

    // Reserve stock via Anti-Corruption Layer port
    const allocated = await this.warehouseStockPort.allocateCargo(input.cargoId, shipmentId, ctx)

    let shipment: Shipment
    try {
      shipment = Shipment.create({
        id: shipmentId,
        originBinId: allocated.binId,
        originBinCode: allocated.binCode,
        cargoSummary: {
          cargoId: allocated.cargoId,
          cargoKind: allocated.cargoKind,
          sku: allocated.sku,
          label: allocated.label,
          handlingClass: allocated.handlingClass,
          weightKg: allocated.weightKg,
          volumeM3: allocated.volumeM3,
          itemCount: allocated.itemCount,
        },
        destination: input.destination,
        carrierMode: input.carrierMode,
        now,
      })

      await this.shipmentRepository.save(shipment)
    } catch (error: unknown) {
      // Compensating action across bounded contexts: release warehouse reservation if shipment creation/save fails
      if (this.warehouseStockPort.releaseCargo) {
        try {
          await this.warehouseStockPort.releaseCargo(input.cargoId, ctx)
        } catch {
          // Best-effort compensation; original error takes precedence
        }
      }
      throw error
    }

    await this.eventBus.publishAll(shipment.pullDomainEvents())

    return mapShipmentToView(shipment, now)
  }
}
