import { hasAnyRole } from '../../../../hexagonal-kernel/core/domain/actor'
import type { Actor } from '../../../../hexagonal-kernel/core/domain/actor'

/**
 * Pure domain RBAC policies for the Delivery Bounded Context (TMS).
 * Single source of truth reused by both:
 * - Application layer (AuthorizingUseCaseDecorator)
 * - Driving adapter layer (nuxt-authorization defineAbility in shared/abilities/)
 */
export function canCreateShipment(actor: Actor | null | undefined): boolean {
  return hasAnyRole(actor, ['dispatcher'])
}

export function canManageShipmentLifecycle(actor: Actor | null | undefined): boolean {
  return hasAnyRole(actor, ['dispatcher'])
}

export function canEvaluateDeliverySlas(actor: Actor | null | undefined): boolean {
  return hasAnyRole(actor, ['dispatcher'])
}
