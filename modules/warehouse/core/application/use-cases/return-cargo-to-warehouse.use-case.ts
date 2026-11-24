import type { ClockPort } from '../../../../hexagonal-kernel/core/application/ports/clock.port'
import type { EventBusPort } from '../../../../hexagonal-kernel/core/application/ports/event-bus.port'
import type { UseCase } from '../../../../hexagonal-kernel/core/application/use-case'
import { CargoNotFoundInBinError } from '../../domain'
import { mapWarehouseBinToView } from '../dtos/warehouse.dtos'
import type { WarehouseBinView } from '../dtos/warehouse.dtos'
import type { WarehouseBinRepositoryPort } from '../ports/outbound/warehouse-bin-repository.port'

export interface ReturnCargoToWarehouseInput {
  readonly cargoId: string
}

export interface ReturnCargoToWarehouseOutput {
  readonly bin: WarehouseBinView
  readonly returnedCargoId: string
}

export class ReturnCargoToWarehouseUseCase implements UseCase<
  ReturnCargoToWarehouseInput,
  ReturnCargoToWarehouseOutput
> {
  readonly name = 'ReturnCargoToWarehouseUseCase'
  readonly boundedContext = 'warehouse'

  constructor(
    private readonly binRepository: WarehouseBinRepositoryPort,
    private readonly eventBus: EventBusPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: ReturnCargoToWarehouseInput): Promise<ReturnCargoToWarehouseOutput> {
    const bin = await this.binRepository.findByCargoId(input.cargoId)
    if (!bin) {
      throw new CargoNotFoundInBinError(input.cargoId)
    }

    bin.returnCargo(input.cargoId, this.clock.now())
    await this.binRepository.save(bin)
    await this.eventBus.publishAll(bin.pullDomainEvents())

    return {
      bin: mapWarehouseBinToView(bin),
      returnedCargoId: input.cargoId,
    }
  }
}
