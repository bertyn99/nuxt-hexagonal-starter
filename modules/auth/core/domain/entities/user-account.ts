import { ROLES } from '../../../../hexagonal-kernel/core/domain/actor'
import type { Actor, Role } from '../../../../hexagonal-kernel/core/domain/actor'
import { ValidationDomainError } from '../../../../hexagonal-kernel/core/domain/domain-error'
import { Entity } from '../../../../hexagonal-kernel/core/domain/entity'
import { AccountDisabledError } from '../errors/auth.errors'

export interface UserAccountSnapshot {
  readonly id: string
  readonly email: string
  readonly name: string
  readonly roles: readonly Role[]
  readonly passwordHash: string
  readonly active: boolean
  readonly createdAt: string
}

export class UserAccount extends Entity<string> {
  readonly email: string
  readonly name: string
  readonly roles: readonly Role[]
  readonly passwordHash: string
  readonly active: boolean
  readonly createdAt: string

  private constructor(params: UserAccountSnapshot) {
    super(params.id)
    this.email = params.email
    this.name = params.name
    this.roles = Object.freeze([...params.roles])
    this.passwordHash = params.passwordHash
    this.active = params.active
    this.createdAt = params.createdAt
  }

  static create(params: {
    id: string
    email: string
    name: string
    roles: readonly Role[]
    passwordHash: string
    active?: boolean
    now: Date
  }): UserAccount {
    const id = params.id.trim()
    const email = params.email.trim().toLowerCase()
    const name = params.name.trim()

    if (!id) {
      throw new ValidationDomainError('INVALID_USER_ID', 'User ID must not be empty')
    }
    if (!email || !email.includes('@')) {
      throw new ValidationDomainError('INVALID_USER_EMAIL', 'A valid email address is required')
    }
    if (!name) {
      throw new ValidationDomainError('INVALID_USER_NAME', 'User display name must not be empty')
    }
    if (!params.passwordHash || params.passwordHash.trim().length === 0) {
      throw new ValidationDomainError('INVALID_PASSWORD_HASH', 'Password hash must not be empty')
    }
    if (params.roles.length === 0) {
      throw new ValidationDomainError('INVALID_USER_ROLES', 'User must have at least one role')
    }

    const uniqueRoles: Role[] = []
    for (const role of params.roles) {
      if (!ROLES.includes(role)) {
        throw new ValidationDomainError('INVALID_USER_ROLE', `Unknown role "${String(role)}"`)
      }
      if (!uniqueRoles.includes(role)) {
        uniqueRoles.push(role)
      }
    }

    return new UserAccount({
      id,
      email,
      name,
      roles: uniqueRoles,
      passwordHash: params.passwordHash,
      active: params.active ?? true,
      createdAt: params.now.toISOString(),
    })
  }

  static rehydrate(snapshot: UserAccountSnapshot): UserAccount {
    return new UserAccount({
      ...snapshot,
      email: snapshot.email.trim().toLowerCase(),
      roles: [...snapshot.roles],
    })
  }

  assertCanAuthenticate(): void {
    if (!this.active) {
      throw new AccountDisabledError(this.id)
    }
  }

  toActor(): Actor {
    return Object.freeze({
      id: this.id,
      email: this.email,
      name: this.name,
      roles: Object.freeze([...this.roles]),
    })
  }

  toSnapshot(): UserAccountSnapshot {
    return {
      id: this.id,
      email: this.email,
      name: this.name,
      roles: [...this.roles],
      passwordHash: this.passwordHash,
      active: this.active,
      createdAt: this.createdAt,
    }
  }
}
