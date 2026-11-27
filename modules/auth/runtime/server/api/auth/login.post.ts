import { useLogger } from 'evlog'
import { defineEventHandler } from 'h3'
import { useHexagonalKernel } from '../../../../../hexagonal-kernel/runtime/server/utils/hexagonal-kernel'
import {
  mapDomainErrorToHttp,
  parseBodyWithSchema,
} from '../../../../../hexagonal-kernel/runtime/server/utils/http-error-mapper'
import { loginRequestSchema } from '../../../../shared/schemas/auth.schema'
import type { AuthSessionDto } from '../../../../shared/types/auth'
import { toAuthUserDto } from '../../utils/auth-context'
import { useAuthModule } from '../../utils/auth-context-container'

export default defineEventHandler(async (event): Promise<AuthSessionDto> => {
  const log = useLogger(event)
  try {
    const kernel = useHexagonalKernel()
    const payload = await parseBodyWithSchema(event, loginRequestSchema)
    const auth = await useAuthModule()
    const userView = await auth.authenticateUser.execute(payload)
    const user = toAuthUserDto(userView)

    await replaceUserSession(event, {
      user,
      loggedInAt: new Date().toISOString(),
    })

    log.audit({
      action: 'auth.login',
      actor: { type: 'user', id: user.id },
      target: { type: 'session', id: user.id },
      outcome: 'success',
    })

    return {
      authenticated: true,
      user,
      demoMode: kernel.config.inspector,
    }
  } catch (error: unknown) {
    mapDomainErrorToHttp(error, event)
  }
})
