import type { DrizzleSqliteDriver } from '../../../../hexagonal-kernel/core/infrastructure/persistence/drizzle-sqlite-driver'
import type { PersistenceMode } from '../../../../hexagonal-kernel/shared/types/inspector'
import type { UserAccountRepositoryPort } from '../../application/ports/outbound/user-account-repository.port'
import { DrizzleSqliteUserAccountRepository } from '../persistence/drizzle/drizzle-sqlite-user-account.repository'
import { InMemoryUserAccountRepository } from '../persistence/in-memory/in-memory-user-account.repository'

export interface AuthPersistenceAdapterFactory {
  create(): {
    adapterName: string
    userRepository: UserAccountRepositoryPort
  }
}

class InMemoryAuthPersistenceFactory implements AuthPersistenceAdapterFactory {
  create() {
    return {
      adapterName: 'InMemoryUserAccountRepository',
      userRepository: new InMemoryUserAccountRepository(),
    }
  }
}

class DrizzleSqliteAuthPersistenceFactory implements AuthPersistenceAdapterFactory {
  constructor(private readonly driver: DrizzleSqliteDriver) {}

  create() {
    return {
      adapterName: 'DrizzleSqliteUserAccountRepository',
      userRepository: new DrizzleSqliteUserAccountRepository(this.driver),
    }
  }
}

export function selectAuthPersistenceFactory(
  mode: PersistenceMode,
  sqliteDriver: DrizzleSqliteDriver | null,
): AuthPersistenceAdapterFactory {
  if (mode === 'drizzle-sqlite' && sqliteDriver) {
    return new DrizzleSqliteAuthPersistenceFactory(sqliteDriver)
  }
  return new InMemoryAuthPersistenceFactory()
}
