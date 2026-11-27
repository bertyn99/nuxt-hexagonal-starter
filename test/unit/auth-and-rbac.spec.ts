import { describe, expect, it, vi } from 'vitest'
import { AuthorizingUseCaseDecorator } from '../../modules/hexagonal-kernel/core/application/decorators/authorizing-use-case.decorator'
import { TracingUseCaseDecorator } from '../../modules/hexagonal-kernel/core/application/decorators/tracing-use-case.decorator'
import type { UseCase } from '../../modules/hexagonal-kernel/core/application/use-case'
import { ANONYMOUS_ACTOR, SYSTEM_ACTOR } from '../../modules/hexagonal-kernel/core/domain/actor'
import type { Actor } from '../../modules/hexagonal-kernel/core/domain/actor'
import {
  ForbiddenError,
  UnauthorizedError,
  ValidationDomainError,
} from '../../modules/hexagonal-kernel/core/domain/domain-error'
import { VirtualClockAdapter } from '../../modules/hexagonal-kernel/core/infrastructure/clock/virtual-clock.adapter'
import { InProcessEventBusAdapter } from '../../modules/hexagonal-kernel/core/infrastructure/event-bus/in-process-event-bus.adapter'
import { InMemoryTraceCollectorAdapter } from '../../modules/hexagonal-kernel/core/infrastructure/trace/in-memory-trace-collector.adapter'
import {
  assertInspectorEnabled,
  createHexagonalKernel,
} from '../../modules/hexagonal-kernel/runtime/server/utils/hexagonal-kernel'
import { AuthenticateUserUseCase } from '../../modules/auth/core/application/use-cases/authenticate-user.use-case'
import type { PasswordHasherPort } from '../../modules/auth/core/application/ports/outbound/password-hasher.port'
import {
  AccountDisabledError,
  InvalidCredentialsError,
  UserAccount,
} from '../../modules/auth/core/domain'
import { InMemoryUserAccountRepository } from '../../modules/auth/core/infrastructure/persistence/in-memory/in-memory-user-account.repository'
import {
  canCreateShipment,
  canManageShipmentLifecycle,
} from '../../modules/delivery/core/domain/policies/delivery-access.policy'
import { CreateShipmentFromWarehouseUseCase } from '../../modules/delivery/core/application/use-cases/create-shipment-from-warehouse.use-case'
import type { ShipmentRepositoryPort } from '../../modules/delivery/core/application/ports/outbound/shipment-repository.port'
import type { WarehouseStockPort } from '../../modules/delivery/core/application/ports/outbound/warehouse-stock.port'
import {
  canAllocateWarehouseCargo,
  canReceiveWarehouseCargo,
  canReleaseWarehouseCargo,
} from '../../modules/warehouse/core/domain/policies/warehouse-access.policy'

const fakeHasher: PasswordHasherPort = {
  async hash(plain) {
    return `fake:${plain}`
  },
  async verify(hashed, plain) {
    return hashed === `fake:${plain}`
  },
}

const adminActor: Actor = {
  id: 'usr-admin',
  email: 'admin@hexlogix.dev',
  name: 'Admin',
  roles: ['admin'],
}

const warehouseActor: Actor = {
  id: 'usr-wh',
  email: 'warehouse@hexlogix.dev',
  name: 'Warehouse Op',
  roles: ['warehouse_operator'],
}

const dispatcherActor: Actor = {
  id: 'usr-disp',
  email: 'dispatcher@hexlogix.dev',
  name: 'Dispatcher',
  roles: ['dispatcher'],
}

const viewerActor: Actor = {
  id: 'usr-view',
  email: 'viewer@hexlogix.dev',
  name: 'Viewer',
  roles: ['viewer'],
}

describe('Auth Domain & Pure RBAC Policies', () => {
  it('enforces UserAccount creation invariants', () => {
    const now = new Date('2026-06-01T00:00:00Z')
    expect(() =>
      UserAccount.create({
        id: 'u1',
        email: 'not-an-email',
        name: 'Bad',
        roles: ['viewer'],
        passwordHash: 'fake:pw',
        now,
      }),
    ).toThrow(ValidationDomainError)

    expect(() =>
      UserAccount.create({
        id: 'u2',
        email: 'ok@hexlogix.dev',
        name: 'NoRoles',
        roles: [],
        passwordHash: 'fake:pw',
        now,
      }),
    ).toThrow(ValidationDomainError)
  })

  it('authenticates active user and rejects wrong password or disabled accounts', async () => {
    const repo = new InMemoryUserAccountRepository()
    const now = new Date('2026-06-01T00:00:00Z')

    await repo.save(
      UserAccount.create({
        id: 'u-active',
        email: 'ops@hexlogix.dev',
        name: 'Active Op',
        roles: ['warehouse_operator'],
        passwordHash: await fakeHasher.hash('secret123'),
        now,
      }),
    )
    await repo.save(
      UserAccount.create({
        id: 'u-disabled',
        email: 'disabled@hexlogix.dev',
        name: 'Disabled Op',
        roles: ['viewer'],
        passwordHash: await fakeHasher.hash('secret123'),
        active: false,
        now,
      }),
    )

    const useCase = new AuthenticateUserUseCase(repo, fakeHasher)

    const user = await useCase.execute({ email: 'OPS@hexlogix.dev', password: 'secret123' })
    expect(user.id).toBe('u-active')
    expect(user.roles).toEqual(['warehouse_operator'])

    await expect(useCase.execute({ email: 'ops@hexlogix.dev', password: 'wrong' })).rejects.toThrow(
      InvalidCredentialsError,
    )

    await expect(
      useCase.execute({ email: 'disabled@hexlogix.dev', password: 'secret123' }),
    ).rejects.toThrow(AccountDisabledError)
  })

  it('evaluates single-source-of-truth RBAC policies across Warehouse and Delivery', () => {
    expect(canReceiveWarehouseCargo(warehouseActor)).toBe(true)
    expect(canReceiveWarehouseCargo(adminActor)).toBe(true)
    expect(canReceiveWarehouseCargo(dispatcherActor)).toBe(false)
    expect(canReceiveWarehouseCargo(viewerActor)).toBe(false)
    expect(canReleaseWarehouseCargo(warehouseActor)).toBe(true)
    expect(canAllocateWarehouseCargo(dispatcherActor)).toBe(true)

    expect(canCreateShipment(dispatcherActor)).toBe(true)
    expect(canCreateShipment(adminActor)).toBe(true)
    expect(canCreateShipment(warehouseActor)).toBe(false)
    expect(canManageShipmentLifecycle(viewerActor)).toBe(false)
    expect(canManageShipmentLifecycle(SYSTEM_ACTOR)).toBe(true)
  })

  it('enforces 401/403 via AuthorizingUseCaseDecorator', async () => {
    const inner: UseCase<{ value: string }, string> = {
      name: 'DummyUseCase',
      boundedContext: 'warehouse',
      async execute(input) {
        return `ok:${input.value}`
      },
    }

    const guarded = new AuthorizingUseCaseDecorator(inner, {
      policyName: 'warehouse:cargo:receive',
      requiredRolesDescription: 'warehouse_operator or admin',
      check: actor => canReceiveWarehouseCargo(actor),
    })

    await expect(guarded.execute({ value: 'x' })).rejects.toThrow(UnauthorizedError)
    await expect(guarded.execute({ value: 'x' }, { actor: ANONYMOUS_ACTOR })).rejects.toThrow(
      UnauthorizedError,
    )
    await expect(guarded.execute({ value: 'x' }, { actor: dispatcherActor })).rejects.toThrow(
      ForbiddenError,
    )
    await expect(guarded.execute({ value: 'x' }, { actor: warehouseActor })).resolves.toBe('ok:x')
    await expect(guarded.execute({ value: 'x' }, { actor: SYSTEM_ACTOR })).resolves.toBe('ok:x')
  })

  it('runs compensating warehouse cargo release if shipment save fails after ACL allocation', async () => {
    const releaseCargo = vi.fn(async () => {})
    const stockPort: WarehouseStockPort = {
      async listAvailableCargo() {
        return [
          {
            binId: 'bin-a01',
            binCode: 'BIN-A01',
            cargoId: 'cargo-1',
            cargoKind: 'PARCEL',
            sku: 'SKU-1',
            label: 'Test Parcel',
            handlingClass: 'STANDARD',
            weightKg: 5,
            volumeM3: 0.1,
            itemCount: 1,
          },
        ]
      },
      async allocateCargo() {
        return {
          binId: 'bin-a01',
          binCode: 'BIN-A01',
          cargoId: 'cargo-1',
          cargoKind: 'PARCEL',
          sku: 'SKU-1',
          label: 'Test Parcel',
          handlingClass: 'STANDARD',
          weightKg: 5,
          volumeM3: 0.1,
          itemCount: 1,
        }
      },
      releaseCargo,
    }

    const failingShipmentRepo: ShipmentRepositoryPort = {
      async findById() {
        return null
      },
      async findByTrackingNumber() {
        return null
      },
      async findAll() {
        return []
      },
      async save() {
        throw new Error('Disk write error')
      },
    }

    const useCase = new CreateShipmentFromWarehouseUseCase(
      failingShipmentRepo,
      stockPort,
      new InProcessEventBusAdapter(),
      new VirtualClockAdapter(new Date('2026-06-01T00:00:00Z')),
    )

    await expect(
      useCase.execute(
        {
          cargoId: 'cargo-1',
          destination: 'Berlin Hub, DE',
          carrierMode: 'STANDARD_GROUND',
        },
        { actor: dispatcherActor },
      ),
    ).rejects.toThrow('Disk write error')

    expect(releaseCargo).toHaveBeenCalledTimes(1)
    expect(releaseCargo).toHaveBeenCalledWith('cargo-1', { actor: dispatcherActor })
  })

  it('runs password verification on missing email and omits email from InvalidCredentialsError details', async () => {
    const repo = new InMemoryUserAccountRepository()
    const verifySpy = vi.fn(async () => false)
    const spyHasher: PasswordHasherPort = {
      hash: fakeHasher.hash,
      verify: verifySpy,
    }
    const useCase = new AuthenticateUserUseCase(repo, spyHasher)

    let caught: unknown
    try {
      await useCase.execute({ email: 'missing@hexlogix.dev', password: 'wrong' })
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(InvalidCredentialsError)
    expect((caught as InvalidCredentialsError).details).toBeUndefined()
    expect(verifySpy).toHaveBeenCalledTimes(1)
  })

  it('records accurate authorization trace steps on 401/403 vs success and handles allowAnonymous consistently', async () => {
    const traceCollector = new InMemoryTraceCollectorAdapter(10)
    const clock = new VirtualClockAdapter(new Date('2026-06-01T00:00:00Z'))
    const eventBus = new InProcessEventBusAdapter()

    const inner: UseCase<{ value: string }, string> = {
      name: 'ProtectedUseCase',
      boundedContext: 'warehouse',
      async execute(input) {
        return `ok:${input.value}`
      },
    }

    const guarded = new AuthorizingUseCaseDecorator(inner, {
      policyName: 'warehouse:cargo:receive',
      requiredRolesDescription: 'warehouse_operator or admin',
      check: actor => canReceiveWarehouseCargo(actor),
    })

    const traced = new TracingUseCaseDecorator(guarded, traceCollector, clock, eventBus, {
      drivingAdapter: 'POST /api/warehouse/cargo',
      domainComponent: 'WarehouseBin',
      drivenAdapter: 'InMemoryWarehouseBinRepository',
      authorized: true,
    })

    await expect(traced.execute({ value: 'denied' }, { actor: dispatcherActor })).rejects.toThrow(
      ForbiddenError,
    )
    const [failedTrace] = traceCollector.getRecentTraces(1)
    expect(failedTrace?.status).toBe('error')
    expect(failedTrace?.errorCode).toBe('FORBIDDEN')
    expect(failedTrace?.steps.map(s => `${s.layer}:${s.status}`)).toEqual([
      'driving-adapter:ok',
      'authorization:error',
    ])

    await expect(traced.execute({ value: 'allowed' }, { actor: warehouseActor })).resolves.toBe(
      'ok:allowed',
    )
    const [okTrace] = traceCollector.getRecentTraces(1)
    expect(okTrace?.status).toBe('ok')
    expect(okTrace?.steps.map(s => `${s.layer}:${s.status}`)).toEqual([
      'driving-adapter:ok',
      'authorization:ok',
      'application:ok',
      'domain:ok',
      'driven-adapter:ok',
    ])

    // allowAnonymous check should behave identically for undefined ctx and ANONYMOUS_ACTOR
    const checkSpy = vi.fn(() => false)
    const anonGuarded = new AuthorizingUseCaseDecorator(inner, {
      policyName: 'public:custom',
      requiredRolesDescription: 'custom check',
      allowAnonymous: true,
      check: checkSpy,
    })
    await expect(anonGuarded.execute({ value: 'a' })).rejects.toThrow(ForbiddenError)
    await expect(anonGuarded.execute({ value: 'b' }, { actor: ANONYMOUS_ACTOR })).rejects.toThrow(
      ForbiddenError,
    )
    expect(checkSpy).toHaveBeenCalledTimes(2)
  })

  it('blocks Architecture Inspector endpoints with 404 when inspector is disabled', () => {
    const disabledKernel = createHexagonalKernel({
      persistence: 'in-memory',
      inspector: false,
    })
    try {
      expect(() => assertInspectorEnabled(disabledKernel)).toThrow(
        expect.objectContaining({ status: 404, code: 'INSPECTOR_DISABLED' }),
      )
    } finally {
      disabledKernel.shutdown()
    }
  })
})
