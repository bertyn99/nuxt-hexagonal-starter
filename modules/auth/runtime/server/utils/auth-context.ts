import type { H3Event } from 'h3'
import { ANONYMOUS_ACTOR, ROLES } from '../../../../hexagonal-kernel/core/domain/actor'
import type { Actor, Role } from '../../../../hexagonal-kernel/core/domain/actor'
import type { AuthUserView } from '../../../core/application/dtos/auth.dtos'
import type { AuthUserDto } from '../../../shared/types/auth'

function sanitizeRoles(raw: unknown): Role[] {
  if (!Array.isArray(raw)) {
    return []
  }
  const allowed = new Set<string>(ROLES)
  return raw.filter((role): role is Role => typeof role === 'string' && allowed.has(role))
}

export function toAuthUserDto(view: AuthUserView): AuthUserDto {
  return {
    id: view.id,
    email: view.email,
    name: view.name,
    roles: [...view.roles],
    active: view.active,
  }
}

/**
 * Driving-adapter bridge: extracts the authenticated session from nuxt-auth-utils
 * and maps it into a validated, framework-agnostic kernel Actor value object.
 *
 * Registered into hexagonal-kernel via `registerActorResolver()` in
 * `modules/auth/runtime/server/plugins/authorization.ts`.
 */
export async function resolveAuthActorFromEvent(event: H3Event): Promise<Actor> {
  const session = await getUserSession(event)
  const raw = session.user as Partial<AuthUserDto> | undefined
  if (!raw || typeof raw.id !== 'string' || raw.id.trim().length === 0) {
    return ANONYMOUS_ACTOR
  }

  return Object.freeze({
    id: raw.id,
    email: typeof raw.email === 'string' ? raw.email : '',
    name: typeof raw.name === 'string' ? raw.name : raw.id,
    roles: Object.freeze(sanitizeRoles(raw.roles)),
  })
}
