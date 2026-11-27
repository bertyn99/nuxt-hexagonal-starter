import type { Role } from '../../../../hexagonal-kernel/core/domain/actor'
import type { UserAccount } from '../../domain/entities/user-account'

export interface AuthUserView {
  readonly id: string
  readonly email: string
  readonly name: string
  readonly roles: readonly Role[]
  readonly active: boolean
}

export function mapUserAccountToView(account: UserAccount): AuthUserView {
  return {
    id: account.id,
    email: account.email,
    name: account.name,
    roles: [...account.roles],
    active: account.active,
  }
}
