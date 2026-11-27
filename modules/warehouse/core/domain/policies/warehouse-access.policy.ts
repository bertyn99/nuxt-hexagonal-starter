import { hasAnyRole } from '../../../../hexagonal-kernel/core/domain/actor'
import type { Actor } from '../../../../hexagonal-kernel/core/domain/actor'

/**
 * Pure domain RBAC policies for the Warehouse Bounded Context (WMS).
 * Single source of truth reused by both:
 * - Application layer (AuthorizingUseCaseDecorator)
 * - Driving adapter layer (nuxt-authorization defineAbility in shared/abilities/)
 */
export function canReceiveWarehouseCargo(actor: Actor | null | undefined): boolean {
  return hasAnyRole(actor, ['warehouse_operator'])
}

export function canReleaseWarehouseCargo(actor: Actor | null | undefined): boolean {
  return hasAnyRole(actor, ['warehouse_operator'])
}

export function canAllocateWarehouseCargo(actor: Actor | null | undefined): boolean {
  return hasAnyRole(actor, ['warehouse_operator', 'dispatcher'])
}

export function canReturnWarehouseCargo(actor: Actor | null | undefined): boolean {
  return hasAnyRole(actor, ['warehouse_operator', 'dispatcher'])
}
