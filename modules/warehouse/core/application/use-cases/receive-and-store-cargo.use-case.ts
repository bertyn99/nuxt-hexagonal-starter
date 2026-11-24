import type { HandlingClass } from '../../../../hexagonal-kernel/core/domain/handling-class'
import type { ClockPort } from '../../../../hexagonal-kernel/core/application/ports/clock.port'
import type { EventBusPort } from '../../../../hexagonal-kernel/core/application/ports/event-bus.port'
import type { UseCase } from '../../../../hexagonal-kernel/core/application/use-case'
import { Dimensions, Pallet, Parcel, WarehouseBinNotFoundError, Weight } from '../../domain'
import type { CargoUnit } from '../../domain'
import { mapWarehouseBinToView } from '../dtos/warehouse.dtos'
import type { WarehouseBinView } from '../dtos/warehouse.dtos'
import type { WarehouseBinRepositoryPort } from '../ports/outbound/warehouse-bin-repository.port'

export interface ReceiveParcelItemInput {
  readonly id?: string
  readonly sku: string
  readonly label: string
  readonly weightKg: number
  readonly lengthCm: number
  readonly widthCm: number
  readonly heightCm: number
  readonly handlingClass: HandlingClass
}

export interface ReceiveAndStoreCargoInput {
  readonly binId: string
  readonly kind: 'PARCEL' | 'PALLET'
  readonly id?: string
  readonly sku: string
  readonly label: string
  readonly parcel?: ReceiveParcelItemInput
  readonly tareWeightKg?: number
  readonly items?: readonly ReceiveParcelItemInput[]
}

export interface ReceiveAndStoreCargoOutput {
  readonly bin: WarehouseBinView
  readonly storedCargoId: string
}

let cargoSeq = 0

function nextCargoId(prefix: 'prc' | 'plt'): string {
  cargoSeq += 1
  return `${prefix}_${Date.now().toString(36)}_${cargoSeq.toString(36).padStart(3, '0')}`
}

export class ReceiveAndStoreCargoUseCase implements UseCase<
  ReceiveAndStoreCargoInput,
  ReceiveAndStoreCargoOutput
> {
  readonly name = 'ReceiveAndStoreCargoUseCase'
  readonly boundedContext = 'warehouse'

  constructor(
    private readonly binRepository: WarehouseBinRepositoryPort,
    private readonly eventBus: EventBusPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: ReceiveAndStoreCargoInput): Promise<ReceiveAndStoreCargoOutput> {
    const bin = await this.binRepository.findById(input.binId)
    if (!bin) {
      throw new WarehouseBinNotFoundError(input.binId)
    }

    let cargo: CargoUnit
    if (input.kind === 'PARCEL') {
      const p = input.parcel!
      cargo = Parcel.create({
        id: input.id ?? p.id ?? nextCargoId('prc'),
        sku: input.sku || p.sku,
        label: input.label || p.label,
        weight: Weight.fromKilograms(p.weightKg),
        dimensions: Dimensions.fromCentimeters(p.lengthCm, p.widthCm, p.heightCm),
        handlingClass: p.handlingClass,
      })
    } else {
      const children = (input.items ?? []).map(item =>
        Parcel.create({
          id: item.id ?? nextCargoId('prc'),
          sku: item.sku,
          label: item.label,
          weight: Weight.fromKilograms(item.weightKg),
          dimensions: Dimensions.fromCentimeters(item.lengthCm, item.widthCm, item.heightCm),
          handlingClass: item.handlingClass,
        }),
      )
      cargo = Pallet.create({
        id: input.id ?? nextCargoId('plt'),
        sku: input.sku,
        label: input.label,
        tareWeight: Weight.fromKilograms(input.tareWeightKg ?? 0),
        children,
      })
    }

    bin.storeCargo(cargo, this.clock.now())
    await this.binRepository.save(bin)
    await this.eventBus.publishAll(bin.pullDomainEvents())

    return {
      bin: mapWarehouseBinToView(bin),
      storedCargoId: cargo.id,
    }
  }
}
