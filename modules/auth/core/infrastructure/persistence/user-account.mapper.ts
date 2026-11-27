import type { Role } from '../../../../hexagonal-kernel/core/domain/actor'
import { UserAccount } from '../../domain/entities/user-account'

export interface UserAccountRecord {
  readonly id: string
  readonly email: string
  readonly name: string
  readonly rolesJson: string
  readonly passwordHash: string
  readonly active: number
  readonly createdAt: string
}

export function toUserAccountRecord(account: UserAccount): UserAccountRecord {
  const snapshot = account.toSnapshot()
  return {
    id: snapshot.id,
    email: snapshot.email,
    name: snapshot.name,
    rolesJson: JSON.stringify(snapshot.roles),
    passwordHash: snapshot.passwordHash,
    active: snapshot.active ? 1 : 0,
    createdAt: snapshot.createdAt,
  }
}

export function fromUserAccountRecord(record: UserAccountRecord): UserAccount {
  const roles = JSON.parse(record.rolesJson) as Role[]
  return UserAccount.rehydrate({
    id: record.id,
    email: record.email,
    name: record.name,
    roles,
    passwordHash: record.passwordHash,
    active: record.active === 1,
    createdAt: record.createdAt,
  })
}
