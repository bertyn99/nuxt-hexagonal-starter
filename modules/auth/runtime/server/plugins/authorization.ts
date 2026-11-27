import { defineNitroPlugin } from 'nitropack/runtime'
import { isAuthenticatedActor } from '../../../../hexagonal-kernel/core/domain/actor'
import { registerActorResolver } from '../../../../hexagonal-kernel/runtime/server/utils/actor-context'
import { resolveAuthActorFromEvent } from '../utils/auth-context'
import { registerAuthModuleMetadata } from '../utils/auth-context-container'

export default defineNitroPlugin(nitroApp => {
  registerActorResolver(resolveAuthActorFromEvent)
  registerAuthModuleMetadata()

  nitroApp.hooks.hook('request', event => {
    event.context.$authorization = {
      resolveServerUser: async <User extends Record<string, unknown>>() => {
        const actor = await resolveAuthActorFromEvent(event)
        return isAuthenticatedActor(actor) ? (actor as unknown as User) : null
      },
    }
  })
})
