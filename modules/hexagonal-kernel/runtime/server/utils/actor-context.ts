import { getHeader } from 'h3'
import type { H3Event } from 'h3'
import type { ExecutionContext } from '../../../core/application/use-case'
import { ANONYMOUS_ACTOR, isAuthenticatedActor } from '../../../core/domain/actor'
import type { Actor } from '../../../core/domain/actor'
import { UnauthorizedError } from '../../../core/domain/domain-error'

export type ActorResolver = (event: H3Event) => Promise<Actor> | Actor

let activeActorResolver: ActorResolver | null = null

/**
 * Registers the active authentication adapter's actor resolver with hexagonal-kernel.
 * Called once at Nitro startup by the auth module (nuxt-auth-utils, Better Auth, etc.)
 * so kernel and bounded-context routes never import modules/auth directly.
 */
export function registerActorResolver(resolver: ActorResolver): void {
  activeActorResolver = resolver
}

export function resetActorResolver(): void {
  activeActorResolver = null
}

export async function resolveActorFromEvent(event: H3Event): Promise<Actor> {
  if (!activeActorResolver) {
    return ANONYMOUS_ACTOR
  }
  const resolved = await activeActorResolver(event)
  return isAuthenticatedActor(resolved) ? resolved : ANONYMOUS_ACTOR
}

export async function resolveExecutionContext(event: H3Event): Promise<ExecutionContext> {
  const actor = await resolveActorFromEvent(event)
  return {
    actor,
    correlationId: getHeader(event, 'x-request-id') ?? undefined,
  }
}

export async function requireActorFromEvent(event: H3Event): Promise<Actor> {
  const actor = await resolveActorFromEvent(event)
  if (!isAuthenticatedActor(actor)) {
    throw new UnauthorizedError('Authentication required for this endpoint')
  }
  return actor
}
