import { DomainError } from '../../domain/domain-error'
import type { ClockPort } from '../ports/clock.port'
import type { EventBusPort } from '../ports/event-bus.port'
import type { TraceCollectorPort, TraceStep } from '../ports/trace-collector.port'
import type { UseCase } from '../use-case'

export interface TracingMetadata {
  readonly drivingAdapter?: string
  readonly domainComponent?: string
  readonly drivenAdapter?: string
}

let traceSeq = 0

export class TracingUseCaseDecorator<TInput, TOutput> implements UseCase<TInput, TOutput> {
  readonly name: string
  readonly boundedContext: string

  constructor(
    private readonly inner: UseCase<TInput, TOutput>,
    private readonly traceCollector: TraceCollectorPort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBusPort,
    private readonly metadata: TracingMetadata = {},
  ) {
    this.name = inner.name
    this.boundedContext = inner.boundedContext
  }

  async execute(input: TInput): Promise<TOutput> {
    traceSeq += 1
    const traceId = `trc_${Date.now().toString(36)}_${traceSeq.toString(36).padStart(4, '0')}`
    const startedAt = this.clock.isoNow()
    const eventsBefore = this.eventBus.getPublishedEvents(1000).length
    const startMs = Date.now()

    const steps: TraceStep[] = []
    if (this.metadata.drivingAdapter) {
      steps.push({
        layer: 'driving-adapter',
        component: this.metadata.drivingAdapter,
        detail: 'Validated DTO via shared Zod schema',
        durationMs: 0.2,
        status: 'ok',
      })
    }

    try {
      const result = await this.inner.execute(input)
      const totalDurationMs = Math.max(0.1, Number((Date.now() - startMs).toFixed(2)))
      const eventsAfter = this.eventBus.getPublishedEvents(1000)
      const emittedEvents = eventsAfter.slice(eventsBefore)

      steps.push({
        layer: 'application',
        component: this.inner.name,
        detail: `Executed in ${this.inner.boundedContext} context`,
        durationMs: Number((totalDurationMs * 0.2).toFixed(2)),
        status: 'ok',
      })

      if (this.metadata.domainComponent) {
        steps.push({
          layer: 'domain',
          component: this.metadata.domainComponent,
          detail: 'Enforced aggregate invariants & policies',
          durationMs: Number((totalDurationMs * 0.35).toFixed(2)),
          status: 'ok',
        })
      }

      if (this.metadata.drivenAdapter) {
        steps.push({
          layer: 'driven-adapter',
          component: this.metadata.drivenAdapter,
          detail: 'Persisted/queried through outbound port',
          durationMs: Number((totalDurationMs * 0.35).toFixed(2)),
          status: 'ok',
        })
      }

      if (emittedEvents.length > 0) {
        steps.push({
          layer: 'event-bus',
          component: 'InProcessEventBus',
          detail: `Published ${emittedEvents.map(e => e.eventName).join(', ')}`,
          durationMs: Number((totalDurationMs * 0.1).toFixed(2)),
          status: 'ok',
        })
      }

      this.traceCollector.recordTrace({
        traceId,
        boundedContext: this.boundedContext,
        useCaseName: this.name,
        startedAt,
        totalDurationMs,
        status: 'ok',
        steps,
      })

      return result
    }
    catch (error: unknown) {
      const totalDurationMs = Math.max(0.1, Number((Date.now() - startMs).toFixed(2)))
      const isDomain = error instanceof DomainError
      const errorCode = isDomain ? error.code : 'UNEXPECTED_ERROR'
      const errorMessage = error instanceof Error ? error.message : String(error)

      steps.push({
        layer: 'application',
        component: this.inner.name,
        detail: `Failed with ${errorCode}`,
        durationMs: Number((totalDurationMs * 0.4).toFixed(2)),
        status: 'error',
      })

      if (this.metadata.domainComponent) {
        steps.push({
          layer: 'domain',
          component: this.metadata.domainComponent,
          detail: errorMessage,
          durationMs: Number((totalDurationMs * 0.6).toFixed(2)),
          status: 'error',
        })
      }

      this.traceCollector.recordTrace({
        traceId,
        boundedContext: this.boundedContext,
        useCaseName: this.name,
        startedAt,
        totalDurationMs,
        status: 'error',
        errorCode,
        errorMessage,
        steps,
      })

      throw error
    }
  }
}
