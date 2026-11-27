import { TracingUseCaseDecorator } from '../../../../hexagonal-kernel/core/application/decorators/tracing-use-case.decorator'
import type { ClockPort } from '../../../../hexagonal-kernel/core/application/ports/clock.port'
import type { EventBusPort } from '../../../../hexagonal-kernel/core/application/ports/event-bus.port'
import type { TraceCollectorPort } from '../../../../hexagonal-kernel/core/application/ports/trace-collector.port'
import type { UseCase } from '../../../../hexagonal-kernel/core/application/use-case'
import type { DrizzleSqliteDriver } from '../../../../hexagonal-kernel/core/infrastructure/persistence/drizzle-sqlite-driver'
import type { PersistenceMode } from '../../../../hexagonal-kernel/shared/types/inspector'
import {
  AuthenticateUserUseCase,
  ListDemoPersonasQuery,
  ResolveUserByIdQuery,
} from '../../application'
import type {
  AuthenticateUserInput,
  AuthUserView,
  PasswordHasherPort,
  ResolveUserByIdInput,
  UserAccountRepositoryPort,
} from '../../application'
import { ScryptPasswordHasherAdapter } from '../security/scrypt-password-hasher.adapter'
import { seedDemoUsersIfEmpty } from './auth-seed'
import { selectAuthPersistenceFactory } from './persistence-adapter.factory'

export interface AuthContainer {
  readonly adapterName: string
  readonly userRepository: UserAccountRepositoryPort
  readonly passwordHasher: PasswordHasherPort
  readonly authenticateUser: UseCase<AuthenticateUserInput, AuthUserView>
  readonly listDemoPersonas: UseCase<void, AuthUserView[]>
  readonly resolveUserById: UseCase<ResolveUserByIdInput, AuthUserView>
  readonly ready: Promise<void>
}

export function createAuthContainer(deps: {
  persistenceMode: PersistenceMode
  sqliteDriver: DrizzleSqliteDriver | null
  eventBus: EventBusPort
  clock: ClockPort
  traceCollector: TraceCollectorPort
  seed?: boolean
}): AuthContainer {
  const factory = selectAuthPersistenceFactory(deps.persistenceMode, deps.sqliteDriver)
  const { adapterName, userRepository } = factory.create()
  const passwordHasher: PasswordHasherPort = new ScryptPasswordHasherAdapter()

  const wrap = <TIn, TOut>(
    useCase: UseCase<TIn, TOut>,
    drivingAdapter: string,
    domainComponent: string,
  ): UseCase<TIn, TOut> => {
    return new TracingUseCaseDecorator(useCase, deps.traceCollector, deps.clock, deps.eventBus, {
      drivingAdapter,
      domainComponent,
      drivenAdapter: adapterName,
    })
  }

  const authenticateUser = wrap(
    new AuthenticateUserUseCase(userRepository, passwordHasher),
    'POST /api/auth/login',
    'UserAccount.assertCanAuthenticate() + PasswordHasherPort',
  )

  const listDemoPersonas = wrap(
    new ListDemoPersonasQuery(userRepository),
    'GET /api/auth/personas',
    'UserAccount Read Model',
  )

  const resolveUserById = wrap(
    new ResolveUserByIdQuery(userRepository),
    'POST /api/auth/switch-persona',
    'UserAccount.assertCanAuthenticate()',
  )

  const ready =
    deps.seed === false
      ? Promise.resolve()
      : seedDemoUsersIfEmpty(userRepository, passwordHasher, deps.clock)

  return {
    adapterName,
    userRepository,
    passwordHasher,
    authenticateUser,
    listDemoPersonas,
    resolveUserById,
    ready,
  }
}
