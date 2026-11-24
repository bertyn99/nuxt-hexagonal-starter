import type { DrizzleSqliteDriver } from '../../../../hexagonal-kernel/core/infrastructure/persistence/drizzle-sqlite-driver'
import type { PersistenceMode } from '../../../../hexagonal-kernel/shared/types/inspector'
import type { WarehouseBinRepositoryPort } from '../../application/ports/outbound/warehouse-bin-repository.port'
import { DrizzleSqliteWarehouseBinRepository } from '../persistence/drizzle/drizzle-sqlite-warehouse-bin.repository'
import { InMemoryWarehouseBinRepository } from '../persistence/in-memory/in-memory-warehouse-bin.repository'

export interface WarehousePersistenceFamily {
  readonly adapterName: string
  readonly binRepository: WarehouseBinRepositoryPort
}

/**
 * Abstract Factory Pattern: instantiates a coherent persistence family
 * ('in-memory' vs 'drizzle-sqlite') for the Warehouse bounded context.
 */
export interface WarehousePersistenceAdapterFactory {
  create(): WarehousePersistenceFamily
}

export class InMemoryWarehousePersistenceFactory implements WarehousePersistenceAdapterFactory {
  create(): WarehousePersistenceFamily {
    return {
      adapterName: 'InMemoryWarehouseBinRepository',
      binRepository: new InMemoryWarehouseBinRepository(),
    }
  }
}

export class DrizzleSqliteWarehousePersistenceFactory implements WarehousePersistenceAdapterFactory {
  constructor(private readonly driver: DrizzleSqliteDriver) {}

  create(): WarehousePersistenceFamily {
    return {
      adapterName: 'DrizzleSqliteWarehouseBinRepository',
      binRepository: new DrizzleSqliteWarehouseBinRepository(this.driver),
    }
  }
}

export function selectWarehousePersistenceFactory(
  mode: PersistenceMode,
  sqliteDriver: DrizzleSqliteDriver | null,
): WarehousePersistenceAdapterFactory {
  if (mode === 'drizzle-sqlite' && sqliteDriver) {
    return new DrizzleSqliteWarehousePersistenceFactory(sqliteDriver)
  }
  return new InMemoryWarehousePersistenceFactory()
}
