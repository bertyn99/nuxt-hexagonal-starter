export { Entity } from './entity'
export { AggregateRoot } from './aggregate-root'
export { ValueObject } from './value-object'
export { createDomainEvent } from './domain-event'
export type { DomainEvent } from './domain-event'
export { DomainError, ValidationDomainError, ok, err } from './domain-error'
export type { DomainErrorStatusHint, Result } from './domain-error'
export {
  HANDLING_CLASSES,
  assertHandlingClass,
  strictestHandlingClass,
  handlingClassSeverity,
} from './handling-class'
export type { HandlingClass } from './handling-class'
