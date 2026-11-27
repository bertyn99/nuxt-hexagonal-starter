<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { loginRequestSchema } from '../../../shared/schemas/auth.schema'
import type { LoginRequestInput } from '../../../shared/schemas/auth.schema'
import type { RoleDto } from '../../../shared/types/auth'

definePageMeta({
  title: 'Sign In (IAM & RBAC)',
})

const router = useRouter()
const { loggedIn, user, demoMode, mutating, login, switchPersona, logout } = useAuth()
const personasQuery = demoMode.value ? useAuthPersonas() : null
const personas = computed(() => personasQuery?.data.value ?? [])

const state = reactive<LoginRequestInput>({
  email: demoMode.value ? 'admin@hexlogix.dev' : '',
  password: demoMode.value ? 'hexlogix-demo' : '',
})

const roleDescriptions: Record<RoleDto, string> = {
  admin: 'Full WMS + TMS write access and Inspector controls (clock & fault injection).',
  warehouse_operator:
    'Can receive & release warehouse cargo; blocked from dispatch/TMS mutations (403).',
  dispatcher:
    'Can create, dispatch, advance, deliver & cancel shipments; blocked from WMS cargo writes (403).',
  viewer: 'Read-only visibility across Warehouse and Deliveries; all mutations return 403.',
}

async function onSubmit(event: FormSubmitEvent<LoginRequestInput>) {
  const res = await login(event.data.email, event.data.password)
  if (res?.authenticated) {
    await router.push('/')
  }
}

async function handleQuickSwitch(userId: string) {
  const res = await switchPersona(userId)
  if (res?.authenticated) {
    await router.push('/')
  }
}
</script>

<template>
  <UDashboardPanel id="auth-login-panel" class="min-w-0">
    <template #header>
      <UDashboardNavbar title="Authentication & RBAC (IAM)" icon="i-lucide-shield">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mx-auto max-w-4xl space-y-6">
        <UAlert
          v-if="loggedIn && user"
          color="success"
          variant="subtle"
          icon="i-lucide-shield-check"
          :title="`Signed in as ${user.name} (${user.email})`"
          :description="`Active roles: ${user.roles.map(formatRoleLabel).join(', ')}`"
          :actions="[{ label: 'Sign out', color: 'neutral', variant: 'outline', onClick: logout }]"
        />

        <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <!-- Real Password Login Form -->
          <UCard :ui="{ body: 'space-y-4 p-5' }">
            <template #header>
              <div>
                <h1 class="text-base font-semibold text-highlighted">Sign in with credentials</h1>
                <p class="text-xs text-muted">
                  Backed by <code>AuthenticateUserUseCase</code>, scrypt hashing, and encrypted
                  <code>nuxt-auth-utils</code> session cookies.
                </p>
              </div>
            </template>

            <UForm :schema="loginRequestSchema" :state="state" class="space-y-4" @submit="onSubmit">
              <UFormField label="Email" name="email" required>
                <UInput
                  v-model="state.email"
                  type="email"
                  icon="i-lucide-mail"
                  placeholder="admin@hexlogix.dev"
                  class="w-full"
                />
              </UFormField>

              <UFormField
                label="Password"
                name="password"
                :hint="demoMode ? 'Demo password: hexlogix-demo' : undefined"
                required
              >
                <UInput
                  v-model="state.password"
                  type="password"
                  icon="i-lucide-key-round"
                  placeholder="••••••••"
                  class="w-full"
                />
              </UFormField>

              <UButton
                type="submit"
                color="primary"
                icon="i-lucide-log-in"
                :loading="mutating"
                block
              >
                Sign in
              </UButton>
            </UForm>
          </UCard>

          <!-- One-Click Demo Personas -->
          <UCard v-if="demoMode" :ui="{ body: 'space-y-3 p-5' }">
            <template #header>
              <div>
                <h2 class="text-base font-semibold text-highlighted">Demo RBAC Personas</h2>
                <p class="text-xs text-muted">
                  Available only when <code>hexagonal.inspector</code> is enabled. Switch roles to
                  see UI abilities (<code>nuxt-authorization</code>) and domain guards
                  (<code>AuthorizingUseCaseDecorator</code>) live.
                </p>
              </div>
            </template>

            <div class="space-y-2.5">
              <div
                v-for="persona in personas"
                :key="persona.id"
                class="flex items-start justify-between gap-3 rounded-lg border border-default p-3"
              >
                <div class="min-w-0 space-y-1">
                  <div class="flex flex-wrap items-center gap-1.5">
                    <span class="text-sm font-medium text-highlighted">{{ persona.name }}</span>
                    <UBadge
                      v-for="role in persona.roles"
                      :key="role"
                      color="primary"
                      variant="subtle"
                      size="xs"
                    >
                      {{ formatRoleLabel(role) }}
                    </UBadge>
                  </div>
                  <p class="font-mono text-[11px] text-muted">{{ persona.email }}</p>
                  <p class="text-xs text-muted">
                    {{ persona.roles[0] ? roleDescriptions[persona.roles[0]] : '' }}
                  </p>
                </div>

                <UButton
                  size="xs"
                  :color="user?.id === persona.id ? 'success' : 'neutral'"
                  :variant="user?.id === persona.id ? 'soft' : 'outline'"
                  :loading="mutating"
                  @click="handleQuickSwitch(persona.id)"
                >
                  {{ user?.id === persona.id ? 'Active' : 'Use role' }}
                </UButton>
              </div>
            </div>
          </UCard>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
