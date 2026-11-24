export type DomainErrorStatusHint =
  | 'validation'
  | 'not_found'
  | 'conflict'
  | 'forbidden'
  | 'unavailable'

export abstract class DomainError extends Error {
  abstract readonly code: string
  abstract readonly statusHint: DomainErrorStatusHint
  readonly details?: Readonly<Record<string, unknown>>

  protected constructor(message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = new.target.name
    this.details = details ? Object.freeze({ ...details }) : undefined
  }
}

export class ValidationDomainError extends DomainError {
  readonly code: string
  readonly statusHint: DomainErrorStatusHint = 'validation'

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message, details)
    this.code = code
  }
}

export type Result<T, E extends DomainError = DomainError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E }

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value }
}

export function err<E extends DomainError>(error: E): Result<never, E> {
  return { ok: false, error }
}
