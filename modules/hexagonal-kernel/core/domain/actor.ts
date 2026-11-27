export const ROLES = ['admin', 'warehouse_operator', 'dispatcher', 'viewer'] as const

export type Role = (typeof ROLES)[number]

export interface Actor {
  readonly id: string
  readonly email: string
  readonly name: string
  readonly roles: readonly Role[]
  readonly isSystem?: boolean
}

export const SYSTEM_ACTOR: Actor = Object.freeze({
  id: 'system',
  email: 'system@hexlogix.internal',
  name: 'System',
  roles: Object.freeze(['admin'] as const),
  isSystem: true,
})

export const ANONYMOUS_ACTOR: Actor = Object.freeze({
  id: 'anonymous',
  email: '',
  name: 'Anonymous',
  roles: Object.freeze([] as const),
})

export function isAuthenticatedActor(actor: Actor | null | undefined): actor is Actor {
  return Boolean(actor && actor.id.trim().length > 0 && actor.id !== ANONYMOUS_ACTOR.id)
}

export function hasAnyRole(
  actor: Actor | null | undefined,
  allowedRoles: readonly Role[],
): boolean {
  if (!isAuthenticatedActor(actor)) {
    return false
  }
  if (actor.isSystem || actor.roles.includes('admin')) {
    return true
  }
  return actor.roles.some(role => allowedRoles.includes(role))
}
