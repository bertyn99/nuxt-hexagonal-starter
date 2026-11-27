import { hasAnyRole } from '../../../../hexagonal-kernel/core/domain/actor'
import type { AuthSessionDto, AuthUserDto, RoleDto } from '../../../shared/types/auth'

const ROLE_LABELS: Record<RoleDto, string> = {
  admin: 'Admin',
  warehouse_operator: 'Warehouse Operator',
  dispatcher: 'Dispatcher',
  viewer: 'Viewer',
}

export function formatRoleLabel(role: RoleDto): string {
  return ROLE_LABELS[role] ?? role
}

export function useAuthPersonas() {
  return useAPI<AuthUserDto[]>('/api/auth/personas', {
    key: API_CACHE_KEYS.authPersonas,
    default: () => [],
  })
}

export function useAuth() {
  const { $api } = useNuxtApp()
  const toast = useToast()
  const { loggedIn, user, fetch: refreshSession, clear: clearSession } = useUserSession()
  const runtimeConfig = useRuntimeConfig()
  const mutating = shallowRef(false)

  const demoMode = computed(() => Boolean(runtimeConfig.public.hexagonal?.inspector))

  const currentUser = computed<AuthUserDto | null>(() => {
    const raw = user.value
    if (!raw || typeof raw !== 'object' || !('id' in raw)) {
      return null
    }
    return raw as AuthUserDto
  })

  const primaryRole = computed<RoleDto | null>(() => currentUser.value?.roles[0] ?? null)

  function hasRole(...allowedRoles: RoleDto[]): boolean {
    return hasAnyRole(currentUser.value, allowedRoles)
  }

  async function login(email: string, password: string): Promise<AuthSessionDto | null> {
    mutating.value = true
    try {
      const res = await $api<AuthSessionDto>('/api/auth/login', {
        method: 'POST',
        body: { email, password },
      })
      await refreshSession()
      toast.add({
        title: `Signed in as ${res.user?.name ?? email}`,
        description: res.user
          ? `Active role: ${res.user.roles.map(formatRoleLabel).join(', ')}`
          : undefined,
        color: 'success',
        icon: 'i-lucide-shield-check',
      })
      return res
    } catch (err: unknown) {
      const { details } = formatApiError(err, 'Unable to sign in')
      toast.add({
        title: 'Sign-in failed',
        description: details,
        color: 'error',
        icon: 'i-lucide-lock',
      })
      return null
    } finally {
      mutating.value = false
    }
  }

  async function switchPersona(userId: string): Promise<AuthSessionDto | null> {
    mutating.value = true
    try {
      const res = await $api<AuthSessionDto>('/api/auth/switch-persona', {
        method: 'POST',
        body: { userId },
      })
      await refreshSession()
      await refreshNuxtData(API_CACHE_KEYS.hexInspector)
      toast.add({
        title: `Switched persona to ${res.user?.name ?? userId}`,
        description: res.user
          ? `Active role: ${res.user.roles.map(formatRoleLabel).join(', ')}`
          : undefined,
        color: 'info',
        icon: 'i-lucide-user-check',
      })
      return res
    } catch (err: unknown) {
      const { details } = formatApiError(err, 'Unable to switch persona')
      toast.add({
        title: 'Persona switch failed',
        description: details,
        color: 'error',
      })
      return null
    } finally {
      mutating.value = false
    }
  }

  async function logout(): Promise<void> {
    mutating.value = true
    try {
      await $api('/api/auth/logout', { method: 'POST' })
      await clearSession()
      toast.add({
        title: 'Signed out',
        description: 'Write operations now require signing back in (401 Unauthorized).',
        color: 'neutral',
        icon: 'i-lucide-log-out',
      })
    } finally {
      mutating.value = false
    }
  }

  return {
    loggedIn,
    user: currentUser,
    primaryRole,
    demoMode,
    mutating: readonly(mutating),
    hasRole,
    login,
    switchPersona,
    logout,
    refreshSession,
  }
}
