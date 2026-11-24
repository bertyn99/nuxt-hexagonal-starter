export interface DomainEvent<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  readonly eventId: string
  readonly eventName: string
  readonly boundedContext: string
  readonly aggregateId: string
  readonly aggregateType: string
  readonly occurredAt: string
  readonly payload: Readonly<TPayload>
}

let eventCounter = 0

export function createDomainEvent<TPayload extends Record<string, unknown>>(params: {
  eventName: string
  boundedContext: string
  aggregateId: string
  aggregateType: string
  occurredAt: Date
  payload: TPayload
}): DomainEvent<TPayload> {
  eventCounter += 1
  const ts = params.occurredAt.getTime().toString(36)
  const seq = eventCounter.toString(36).padStart(4, '0')
  return Object.freeze({
    eventId: `evt_${ts}_${seq}`,
    eventName: params.eventName,
    boundedContext: params.boundedContext,
    aggregateId: params.aggregateId,
    aggregateType: params.aggregateType,
    occurredAt: params.occurredAt.toISOString(),
    payload: Object.freeze({ ...params.payload }),
  })
}
