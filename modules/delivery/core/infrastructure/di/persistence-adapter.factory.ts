import type { DrizzleSqliteDriver } from '../../../../hexagonal-kernel/core/infrastructure/persistence/drizzle-sqlite-driver'
import type { PersistenceMode } from '../../../../hexagonal-kernel/shared/types/inspector'
import type { ShipmentRepositoryPort } from '../../application/ports/outbound/shipment-repository.port'
import { DrizzleSqliteShipmentRepository } from '../persistence/drizzle/drizzle-sqlite-shipment.repository'
import { InMemoryShipmentRepository } from '../persistence/in-memory/in-memory-shipment.repository'

export interface DeliveryPersistenceFamily {
  readonly adapterName: string
  readonly shipmentRepository: ShipmentRepositoryPort
}

/**
 * Abstract Factory Pattern: instantiates a coherent persistence family
 * ('in-memory' vs 'drizzle-sqlite') for the Delivery bounded context.
 */
export interface DeliveryPersistenceAdapterFactory {
  create(): DeliveryPersistenceFamily
}

export class InMemoryDeliveryPersistenceFactory implements DeliveryPersistenceAdapterFactory {
  create(): DeliveryPersistenceFamily {
    return {
      adapterName: 'InMemoryShipmentRepository',
      shipmentRepository: new InMemoryShipmentRepository(),
    }
  }
}

export class DrizzleSqliteDeliveryPersistenceFactory implements DeliveryPersistenceAdapterFactory {
  constructor(private readonly driver: DrizzleSqliteDriver) {}

  create(): DeliveryPersistenceFamily {
    return {
      adapterName: 'DrizzleSqliteShipmentRepository',
      shipmentRepository: new DrizzleSqliteShipmentRepository(this.driver),
    }
  }
}

export function selectDeliveryPersistenceFactory(
  mode: PersistenceMode,
  sqliteDriver: DrizzleSqliteDriver | null,
): DeliveryPersistenceAdapterFactory {
  if (mode === 'drizzle-sqlite' && sqliteDriver) {
    return new DrizzleSqliteDeliveryPersistenceFactory(sqliteDriver)
  }
  return new InMemoryDeliveryPersistenceFactory()
}
