import { useLogger } from 'evlog'
import { defineEventHandler } from 'h3'
import { resolveActorFromEvent } from '../../../../../hexagonal-kernel/runtime/server/utils/actor-context'
import {
  assertInspectorEnabled,
  useHexagonalKernel,
} from '../../../../../hexagonal-kernel/runtime/server/utils/hexagonal-kernel'
import {
  mapDomainErrorToHttp,
  parseBodyWithSchema,
} from '../../../../../hexagonal-kernel/runtime/server/utils/http-error-mapper'
import { switchPersonaRequestSchema } from '../../../../shared/schemas/auth.schema'
import type { AuthSessionDto } from '../../../../shared/types/auth'
import { toAuthUserDto } from '../../utils/auth-context'
import { useAuthModule } from '../../utils/auth-context-container'

/**
 * Dev/Inspector-only persona switcher so template adopters can test RBAC roles
 * (Admin, Warehouse Operator, Dispatcher, Viewer) live without typing credentials.
 */
export default defineEventHandler(async (event): Promise<AuthSessionDto> => {
  const log = useLogger(event)
  try {
    const kernel = useHexagonalKernel()
    assertInspectorEnabled(kernel)

    const previousActor = await resolveActorFromEvent(event)
    const payload = await parseBodyWithSchema(event, switchPersonaRequestSchema)
    const auth = await useAuthModule()
    const userView = await auth.resolveUserById.execute({ userId: payload.userId })
    const user = toAuthUserDto(userView)

    await setUserSession(event, {
      user,
      loggedInAt: new Date().toISOString(),
    })

    log.audit({
      action: 'auth.switch_persona',
      actor: { type: 'user', id: previousActor.id },
      target: { type: 'user', id: user.id },
      outcome: 'success',
      changes: {
        before: { roles: [...previousActor.roles] },
        after: { roles: [...user.roles] },
      },
    })

    return {
      authenticated: true,
      user,
      demoMode: true,
    }
  } catch (error: unknown) {
    mapDomainErrorToHttp(error, event)
  }
})
