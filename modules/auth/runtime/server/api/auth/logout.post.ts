import { useLogger } from 'evlog'
import { defineEventHandler } from 'h3'
import { useHexagonalKernel } from '../../../../../hexagonal-kernel/runtime/server/utils/hexagonal-kernel'
import { mapDomainErrorToHttp } from '../../../../../hexagonal-kernel/runtime/server/utils/http-error-mapper'
import type { AuthSessionDto } from '../../../../shared/types/auth'
import { resolveActorFromEvent } from '../../../../../hexagonal-kernel/runtime/server/utils/actor-context'

export default defineEventHandler(async (event): Promise<AuthSessionDto> => {
  const log = useLogger(event)
  try {
    const actor = await resolveActorFromEvent(event)
    const kernel = useHexagonalKernel()
    await clearUserSession(event)

    log.audit({
      action: 'auth.logout',
      actor: { type: 'user', id: actor.id },
      target: { type: 'session', id: actor.id },
      outcome: 'success',
    })

    return {
      authenticated: false,
      user: null,
      demoMode: kernel.config.inspector,
    }
  } catch (error: unknown) {
    mapDomainErrorToHttp(error, event)
  }
})
