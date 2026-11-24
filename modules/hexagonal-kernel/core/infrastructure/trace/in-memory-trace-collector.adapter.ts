import type { ExecutionTrace, TraceCollectorPort } from '../../application/ports/trace-collector.port'

export class InMemoryTraceCollectorAdapter implements TraceCollectorPort {
  private readonly traces: ExecutionTrace[] = []
  private readonly maxEntries: number

  constructor(maxEntries = 50) {
    this.maxEntries = maxEntries
  }

  recordTrace(trace: ExecutionTrace): void {
    this.traces.unshift(trace)
    if (this.traces.length > this.maxEntries) {
      this.traces.length = this.maxEntries
    }
  }

  getRecentTraces(limit = 20): readonly ExecutionTrace[] {
    return this.traces.slice(0, limit)
  }

  clear(): void {
    this.traces.length = 0
  }
}
