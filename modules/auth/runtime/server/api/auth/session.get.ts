import { defineEventHandler } from 'h3'
import { isAuthenticatedActor } from '../../../../../hexagonal-kernel/core/domain/actor'
import { resolveActorFromEvent } from '../../../../../hexagonal-kernel/runtime/server/utils/actor-context'
import { useHexagonalKernel } from '../../../../../hexagonal-kernel/runtime/server/utils/hexagonal-kernel'
import { mapDomainErrorToHttp } from '../../../../../hexagonal-kernel/runtime/server/utils/http-error-mapper'
import type { AuthSessionDto, AuthUserDto } from '../../../../shared/types/auth'

export default defineEventHandler(async (event): Promise<AuthSessionDto> => {
  try {
    const kernel = useHexagonalKernel()
    const actor = await resolveActorFromEvent(event)
    const authenticated = isAuthenticatedActor(actor)
    const user: AuthUserDto | null = authenticated
      ? {
          id: actor.id,
          email: actor.email,
          name: actor.name,
          roles: [...actor.roles],
          active: true,
        }
      : null

    return {
      authenticated,
      user,
      demoMode: kernel.config.inspector,
    }
  } catch (error: unknown) {
    mapDomainErrorToHttp(error, event)
  }
})
