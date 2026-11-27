<script setup lang="ts">
import type { RoleDto } from '../../../shared/types/auth'

const props = withDefaults(
  defineProps<{
    compact?: boolean
  }>(),
  {
    compact: false,
  },
)

const router = useRouter()
const { loggedIn, user, primaryRole, demoMode, mutating, switchPersona, logout } = useAuth()
const personasQuery = demoMode.value ? useAuthPersonas() : null

const personas = computed(() => personasQuery?.data.value ?? [])

const roleColors: Record<RoleDto, 'primary' | 'info' | 'warning' | 'neutral'> = {
  admin: 'primary',
  warehouse_operator: 'info',
  dispatcher: 'warning',
  viewer: 'neutral',
}

const menuItems = computed(() => {
  const groups: Array<
    Array<{
      label: string
      icon?: string
      disabled?: boolean
      color?: 'error' | 'primary' | 'neutral'
      onSelect?: () => void
    }>
  > = []

  if (demoMode.value && personas.value.length > 0) {
    groups.push(
      personas.value.map(persona => ({
        label: `${persona.name} (${persona.roles.map(formatRoleLabel).join(', ')})`,
        icon: user.value?.id === persona.id ? 'i-lucide-check' : 'i-lucide-user',
        onSelect: () => {
          void switchPersona(persona.id)
        },
      })),
    )
  }

  const actions: Array<{
    label: string
    icon?: string
    color?: 'error' | 'primary' | 'neutral'
    onSelect?: () => void
  }> = [
    {
      label: loggedIn.value ? 'Sign in with password (/login)' : 'Sign in (/login)',
      icon: 'i-lucide-log-in',
      onSelect: () => {
        void router.push('/login')
      },
    },
  ]

  if (loggedIn.value) {
    actions.push({
      label: 'Sign out (Anonymous)',
      icon: 'i-lucide-log-out',
      color: 'error',
      onSelect: () => {
        void logout()
      },
    })
  }

  groups.push(actions)
  return groups
})
</script>

<template>
  <UDropdownMenu :items="menuItems" :content="{ align: 'start' }">
    <UButton
      size="xs"
      color="neutral"
      variant="soft"
      :loading="mutating"
      :icon="loggedIn ? 'i-lucide-shield-check' : 'i-lucide-user-x'"
      :class="props.compact ? 'w-full justify-between' : ''"
    >
      <template v-if="!props.compact">
        <span class="truncate max-w-36">
          {{ user ? user.name : 'Anonymous (Read-Only)' }}
        </span>
        <UBadge v-if="primaryRole" :color="roleColors[primaryRole]" variant="subtle" size="xs">
          {{ formatRoleLabel(primaryRole) }}
        </UBadge>
      </template>
      <template v-else>
        <span class="truncate text-left">
          {{ user ? user.name : 'Anonymous' }}
        </span>
        <UBadge v-if="primaryRole" :color="roleColors[primaryRole]" variant="subtle" size="xs">
          {{ formatRoleLabel(primaryRole) }}
        </UBadge>
      </template>
    </UButton>
  </UDropdownMenu>
</template>
