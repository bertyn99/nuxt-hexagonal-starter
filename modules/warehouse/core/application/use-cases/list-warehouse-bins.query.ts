import type { UseCase } from '../../../../hexagonal-kernel/core/application/use-case'
import type { StorageZone } from '../../domain'
import { mapWarehouseBinToView } from '../dtos/warehouse.dtos'
import type { WarehouseBinView } from '../dtos/warehouse.dtos'
import type { WarehouseBinRepositoryPort } from '../ports/outbound/warehouse-bin-repository.port'

export interface ListWarehouseBinsInput {
  readonly zone?: StorageZone
}

export class ListWarehouseBinsQuery implements UseCase<ListWarehouseBinsInput, WarehouseBinView[]> {
  readonly name = 'ListWarehouseBinsQuery'
  readonly boundedContext = 'warehouse'

  constructor(private readonly binRepository: WarehouseBinRepositoryPort) {}

  async execute(input: ListWarehouseBinsInput = {}): Promise<WarehouseBinView[]> {
    const bins = await this.binRepository.findAll(input.zone ? { zone: input.zone } : undefined)
    return bins.map(mapWarehouseBinToView)
  }
}
