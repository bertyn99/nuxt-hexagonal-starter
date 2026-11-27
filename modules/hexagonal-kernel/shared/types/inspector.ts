export type PersistenceMode = 'in-memory' | 'drizzle-sqlite'
export type CarrierAdapterMode = 'simulated' | 'webhook-console'
export type ClockAdapterMode = 'system' | 'virtual'

export interface HexagonalOptionsDto {
  persistence: PersistenceMode
  carrier: CarrierAdapterMode
  clock: ClockAdapterMode
  inspector: boolean
  sqlitePath: string
}

export interface RegisteredModuleDto {
  name: string
  boundedContext: string
  description: string
  persistenceAdapter: string
  endpointsPrefix: string
  pagePath: string
}

export interface TraceStepDto {
  layer:
    | 'driving-adapter'
    | 'authorization'
    | 'application'
    | 'domain'
    | 'driven-adapter'
    | 'event-bus'
  component: string
  detail: string
  durationMs: number
  status: 'ok' | 'error'
}

export interface CallTraceDto {
  traceId: string
  boundedContext: string
  useCaseName: string
  startedAt: string
  totalDurationMs: number
  status: 'ok' | 'error'
  errorCode?: string
  errorMessage?: string
  steps: TraceStepDto[]
}

export interface AuditEntryDto {
  id: string
  eventId: string
  eventName: string
  boundedContext: string
  aggregateId: string
  aggregateType: string
  occurredAt: string
  summary: string
  payload: Record<string, unknown>
}

export interface CarrierFaultStateDto {
  outageEnabled: boolean
  extraDelayHours: number
}

export interface VirtualClockDto {
  mode: ClockAdapterMode
  currentTimeIso: string
  offsetHours: number
  controllable: boolean
}

export interface InspectorSnapshotDto {
  config: HexagonalOptionsDto
  adapters: {
    persistence: string
    carrier: string
    clock: string
    eventBus: string
    auditLog: string
  }
  modules: RegisteredModuleDto[]
  clock: VirtualClockDto
  faults: CarrierFaultStateDto
  traces: CallTraceDto[]
  recentEvents: AuditEntryDto[]
  boundaryStatus: {
    healthy: boolean
    checkedModules: string[]
  }
}
