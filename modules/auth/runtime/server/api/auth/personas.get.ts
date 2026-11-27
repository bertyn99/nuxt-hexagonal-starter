import { defineEventHandler } from 'h3'
import {
  assertInspectorEnabled,
  useHexagonalKernel,
} from '../../../../../hexagonal-kernel/runtime/server/utils/hexagonal-kernel'
import { mapDomainErrorToHttp } from '../../../../../hexagonal-kernel/runtime/server/utils/http-error-mapper'
import type { AuthUserDto } from '../../../../shared/types/auth'
import { toAuthUserDto } from '../../utils/auth-context'
import { useAuthModule } from '../../utils/auth-context-container'

export default defineEventHandler(async (event): Promise<AuthUserDto[]> => {
  try {
    const kernel = useHexagonalKernel()
    assertInspectorEnabled(kernel)

    const auth = await useAuthModule()
    const personas = await auth.listDemoPersonas.execute()
    return personas.map(toAuthUserDto)
  } catch (error: unknown) {
    mapDomainErrorToHttp(error, event)
  }
})
