import { defineAbility } from 'nuxt-authorization/utils'
import type { Actor } from '../../../hexagonal-kernel/core/domain/actor'
import {
  canCreateShipment,
  canEvaluateDeliverySlas,
  canManageShipmentLifecycle,
} from '../../core/domain/policies/delivery-access.policy'

export const createShipmentAbility = defineAbility((user: Actor | null) => canCreateShipment(user))

export const manageShipmentAbility = defineAbility((user: Actor | null) =>
  canManageShipmentLifecycle(user),
)

export const evaluateSlasAbility = defineAbility((user: Actor | null) =>
  canEvaluateDeliverySlas(user),
)
