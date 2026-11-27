import { DomainError } from '../../../../hexagonal-kernel/core/domain/domain-error'
import type { DomainErrorStatusHint } from '../../../../hexagonal-kernel/core/domain/domain-error'

export class InvalidCredentialsError extends DomainError {
  readonly code = 'INVALID_CREDENTIALS'
  readonly statusHint: DomainErrorStatusHint = 'unauthorized'

  constructor() {
    super('Invalid email or password')
  }
}

export class AccountDisabledError extends DomainError {
  readonly code = 'ACCOUNT_DISABLED'
  readonly statusHint: DomainErrorStatusHint = 'forbidden'

  constructor(userId: string) {
    super(`User account "${userId}" is disabled`, { userId })
  }
}

export class UserNotFoundError extends DomainError {
  readonly code = 'USER_NOT_FOUND'
  readonly statusHint: DomainErrorStatusHint = 'not_found'

  constructor(identifier: string) {
    super(`User account "${identifier}" was not found`, { identifier })
  }
}
