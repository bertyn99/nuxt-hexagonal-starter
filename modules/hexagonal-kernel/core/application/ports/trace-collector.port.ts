export type HexagonalLayer = 'driving-adapter' | 'application' | 'domain' | 'driven-adapter' | 'event-bus'

export interface TraceStep {
  readonly layer: HexagonalLayer
  readonly component: string
  readonly detail: string
  readonly durationMs: number
  readonly status: 'ok' | 'error'
}

export interface ExecutionTrace {
  readonly traceId: string
  readonly boundedContext: string
  readonly useCaseName: string
  readonly startedAt: string
  readonly totalDurationMs: number
  readonly status: 'ok' | 'error'
  readonly errorCode?: string
  readonly errorMessage?: string
  readonly steps: readonly TraceStep[]
}

export interface TraceCollectorPort {
  recordTrace(trace: ExecutionTrace): void
  getRecentTraces(limit?: number): readonly ExecutionTrace[]
  clear(): void
}
