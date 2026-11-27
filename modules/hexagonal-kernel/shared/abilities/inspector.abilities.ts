import { defineAbility } from 'nuxt-authorization/utils'
import { hasAnyRole } from '../../core/domain/actor'
import type { Actor } from '../../core/domain/actor'

export const controlInspectorAbility = defineAbility((user: Actor | null) =>
  hasAnyRole(user, ['admin']),
)
