import { resolve } from 'node:path'
import { log } from 'evlog'
import { registerAuditLogSubscriber } from '../../../core/application/audit-log.subscriber'
import type { AuditLogPort } from '../../../core/application/ports/audit-log.port'
import type { ClockPort, ControllableClockPort } from '../../../core/application/ports/clock.port'
import type { EventBusPort } from '../../../core/application/ports/event-bus.port'
import type { TraceCollectorPort } from '../../../core/application/ports/trace-collector.port'
import { DrizzleSqliteAuditLogAdapter } from '../../../core/infrastructure/audit/drizzle-sqlite-audit-log.adapter'
import { InMemoryAuditLogAdapter } from '../../../core/infrastructure/audit/in-memory-audit-log.adapter'
import { SystemClockAdapter } from '../../../core/infrastructure/clock/system-clock.adapter'
import { VirtualClockAdapter } from '../../../core/infrastructure/clock/virtual-clock.adapter'
import { InProcessEventBusAdapter } from '../../../core/infrastructure/event-bus/in-process-event-bus.adapter'
import { DrizzleSqliteDriver } from '../../../core/infrastructure/persistence/drizzle-sqlite-driver'
import { InMemoryTraceCollectorAdapter } from '../../../core/infrastructure/trace/in-memory-trace-collector.adapter'
import type {
  CarrierFaultStateDto,
  HexagonalOptionsDto,
  InspectorSnapshotDto,
  RegisteredModuleDto,
} from '../../../shared/types/inspector'

export interface HexagonalKernelRuntime {
  readonly config: HexagonalOptionsDto
  readonly clock: ClockPort
  readonly controllableClock: ControllableClockPort | null
  readonly eventBus: EventBusPort
  readonly auditLog: AuditLogPort
  readonly traceCollector: TraceCollectorPort
  readonly sqliteDriver: DrizzleSqliteDriver | null
  readonly faultState: CarrierFaultStateDto
  registerModule(info: RegisteredModuleDto): void
  getRegisteredModules(): RegisteredModuleDto[]
  getInspectorSnapshot(): Promise<InspectorSnapshotDto>
  shutdown(): void
}

const DEFAULT_CONFIG: HexagonalOptionsDto = {
  persistence: 'drizzle-sqlite',
  carrier: 'simulated',
  clock: 'virtual',
  inspector: true,
  sqlitePath: '.data/logistics.sqlite',
}

let kernelInstance: HexagonalKernelRuntime | null = null

function resolveKernelConfig(): HexagonalOptionsDto {
  try {
    const runtimeConfig = useRuntimeConfig()
    const raw = (runtimeConfig.hexagonal ?? {}) as Partial<HexagonalOptionsDto>
    return {
      persistence: raw.persistence ?? DEFAULT_CONFIG.persistence,
      carrier: raw.carrier ?? DEFAULT_CONFIG.carrier,
      clock: raw.clock ?? DEFAULT_CONFIG.clock,
      inspector: raw.inspector ?? DEFAULT_CONFIG.inspector,
      sqlitePath: raw.sqlitePath ?? DEFAULT_CONFIG.sqlitePath,
    }
  } catch (error: unknown) {
    if (!process.env.VITEST) {
      log.warn({
        component: 'hexagonal-kernel',
        action: 'resolve_config_fallback',
        reason: error instanceof Error ? error.message : String(error),
      })
    }
    return { ...DEFAULT_CONFIG }
  }
}

export function createHexagonalKernel(
  overrideConfig?: Partial<HexagonalOptionsDto>,
): HexagonalKernelRuntime {
  const base = resolveKernelConfig()
  const config: HexagonalOptionsDto = { ...base, ...overrideConfig }

  const virtualClock = config.clock === 'virtual' ? new VirtualClockAdapter() : null
  const clock: ClockPort = virtualClock ?? new SystemClockAdapter()
  const eventBus = new InProcessEventBusAdapter(300)
  const traceCollector = new InMemoryTraceCollectorAdapter(50)

  const sqliteDriver =
    config.persistence === 'drizzle-sqlite'
      ? new DrizzleSqliteDriver(
          config.sqlitePath === ':memory:' ? ':memory:' : resolve(process.cwd(), config.sqlitePath),
        )
      : null

  const auditLog: AuditLogPort = sqliteDriver
    ? new DrizzleSqliteAuditLogAdapter(sqliteDriver)
    : new InMemoryAuditLogAdapter()

  registerAuditLogSubscriber(eventBus, auditLog)

  const modules = new Map<string, RegisteredModuleDto>()
  const faultState: CarrierFaultStateDto = {
    outageEnabled: false,
    extraDelayHours: 0,
  }

  return {
    config,
    clock,
    controllableClock: virtualClock,
    eventBus,
    auditLog,
    traceCollector,
    sqliteDriver,
    faultState,

    registerModule(info: RegisteredModuleDto): void {
      modules.set(info.name, info)
    },

    getRegisteredModules(): RegisteredModuleDto[] {
      return Array.from(modules.values())
    },

    async getInspectorSnapshot(): Promise<InspectorSnapshotDto> {
      const recentEvents = await auditLog.listRecent(30)
      const offsetHours = virtualClock
        ? Number((virtualClock.getOffsetMs() / (60 * 60 * 1000)).toFixed(2))
        : 0

      return {
        config,
        adapters: {
          persistence:
            config.persistence === 'drizzle-sqlite'
              ? `DrizzleSqliteAdapter (${config.sqlitePath})`
              : 'InMemoryRepositoryAdapter',
          carrier:
            config.carrier === 'simulated'
              ? 'SimulatedCarrierGatewayAdapter'
              : 'WebhookConsoleCarrierAdapter',
          clock: config.clock === 'virtual' ? 'VirtualClockAdapter' : 'SystemClockAdapter',
          eventBus: 'InProcessEventBusAdapter',
          auditLog: sqliteDriver ? 'DrizzleSqliteAuditLogAdapter' : 'InMemoryAuditLogAdapter',
        },
        modules: Array.from(modules.values()),
        clock: {
          mode: clock.mode,
          currentTimeIso: clock.isoNow(),
          offsetHours,
          controllable: virtualClock !== null,
        },
        faults: { ...faultState },
        traces: traceCollector.getRecentTraces(20).map(trace => ({
          ...trace,
          steps: trace.steps.map(step => ({ ...step })),
        })),
        recentEvents: recentEvents.map(entry => ({
          ...entry,
          payload: { ...entry.payload },
        })),
        boundaryStatus: {
          healthy: true,
          checkedModules: ['hexagonal-kernel', ...Array.from(modules.keys())],
        },
      }
    },

    shutdown(): void {
      sqliteDriver?.close()
    },
  }
}

export function useHexagonalKernel(): HexagonalKernelRuntime {
  if (!kernelInstance) {
    kernelInstance = createHexagonalKernel()
  }
  return kernelInstance
}

export function resetHexagonalKernel(
  overrideConfig?: Partial<HexagonalOptionsDto>,
): HexagonalKernelRuntime {
  kernelInstance?.shutdown()
  kernelInstance = createHexagonalKernel(overrideConfig)
  return kernelInstance
}

export function shutdownHexagonalKernel(): void {
  kernelInstance?.shutdown()
  kernelInstance = null
}
