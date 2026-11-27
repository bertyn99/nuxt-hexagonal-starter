import { useHexagonalKernel } from '../../../../hexagonal-kernel/runtime/server/utils/hexagonal-kernel'
import { registerDomainErrorGuidance } from '../../../../hexagonal-kernel/runtime/server/utils/http-error-mapper'
import { createAuthContainer } from '../../../core/infrastructure/di/container'
import type { AuthContainer } from '../../../core/infrastructure/di/container'

registerDomainErrorGuidance({
  INVALID_CREDENTIALS: {
    title: 'Invalid email or password',
    fix: 'Check your email and password, or select a seeded demo persona on /login.',
  },
  ACCOUNT_DISABLED: {
    title: 'User account is disabled',
    fix: 'Contact an administrator or sign in with an active account.',
  },
  USER_NOT_FOUND: {
    title: 'User account not found',
    fix: 'Verify the user identifier and try again.',
  },
})

let authInstance: AuthContainer | null = null

export function registerAuthModuleMetadata(adapterName?: string): void {
  const kernel = useHexagonalKernel()
  kernel.registerModule({
    name: 'auth',
    boundedContext: 'IAM (Auth & RBAC)',
    description:
      'Session authentication (nuxt-auth-utils), isomorphic abilities (nuxt-authorization), and RBAC personas.',
    persistenceAdapter:
      adapterName ??
      (kernel.config.persistence === 'drizzle-sqlite'
        ? 'DrizzleSqliteUserAccountRepository'
        : 'InMemoryUserAccountRepository'),
    endpointsPrefix: '/api/auth/*',
    pagePath: '/login',
  })
}

export async function useAuthModule(): Promise<AuthContainer> {
  if (!authInstance) {
    const kernel = useHexagonalKernel()
    authInstance = createAuthContainer({
      persistenceMode: kernel.config.persistence,
      sqliteDriver: kernel.sqliteDriver,
      eventBus: kernel.eventBus,
      clock: kernel.clock,
      traceCollector: kernel.traceCollector,
      seed: kernel.config.inspector,
    })

    registerAuthModuleMetadata(authInstance.adapterName)
  }

  await authInstance.ready
  return authInstance
}

export function resetAuthModule(): void {
  authInstance = null
}
