import { defineAbility } from 'nuxt-authorization/utils'
import type { Actor } from '../../../hexagonal-kernel/core/domain/actor'
import {
  canReceiveWarehouseCargo,
  canReleaseWarehouseCargo,
} from '../../core/domain/policies/warehouse-access.policy'

export const receiveWarehouseCargoAbility = defineAbility((user: Actor | null) =>
  canReceiveWarehouseCargo(user),
)

export const releaseWarehouseCargoAbility = defineAbility((user: Actor | null) =>
  canReleaseWarehouseCargo(user),
)
