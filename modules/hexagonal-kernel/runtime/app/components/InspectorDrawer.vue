<script setup lang="ts">
const { isOpen, mutating, advanceClock, resetClock, updateFaults, evaluateSlas } = useHexInspector()

const snapshotQuery = useHexInspectorSnapshot()
const activeTab = shallowRef<'controls' | 'traces'>('controls')

const snapshot = computed(() => snapshotQuery.data.value ?? null)
const loading = computed(() => snapshotQuery.status.value === 'pending' || mutating.value)
const loadError = computed(() =>
  snapshotQuery.error.value
    ? formatApiError(snapshotQuery.error.value, 'Failed to load inspector snapshot').details
    : null,
)

const inspectorTabs = computed(() => [
  { label: 'Controls & Adapters', value: 'controls', icon: 'i-lucide-sliders-horizontal' },
  {
    label: 'Call Traces',
    value: 'traces',
    icon: 'i-lucide-activity',
    badge: String(snapshot.value?.traces.length ?? 0),
  },
])

onMounted(() => {
  if (snapshotQuery.status.value !== 'pending') {
    snapshotQuery.refresh()
  }
})

function refresh() {
  return snapshotQuery.refresh()
}

function toggleOutage(enabled: boolean) {
  updateFaults({ outageEnabled: enabled })
}

function setExtraDelay(hours: number) {
  updateFaults({ extraDelayHours: hours })
}
</script>

<template>
  <USlideover
    v-model:open="isOpen"
    title="Hexagonal Architecture Inspector"
    description="Live ports, active adapters, virtual clock time-travel, fault injection, and layer traces."
    side="right"
    :ui="{ content: 'max-w-xl' }"
  >
    <template #body>
      <div class="space-y-4">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <UBadge color="success" variant="subtle" icon="i-lucide-shield-check">
              Boundary Guard Healthy
            </UBadge>
            <UBadge v-if="snapshot" color="neutral" variant="outline" class="tabular-nums">
              {{ snapshot.modules.length }} Bounded Contexts
            </UBadge>
          </div>
          <UButton
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-refresh-cw"
            :loading="loading"
            @click="refresh"
          >
            Refresh
          </UButton>
        </div>

        <UTabs
          v-model="activeTab"
          :items="inspectorTabs"
          :content="false"
          size="sm"
          class="w-full"
        />

        <UAlert
          v-if="loadError"
          color="error"
          variant="subtle"
          icon="i-lucide-alert-circle"
          title="Unable to load inspector snapshot"
          :description="loadError"
          :actions="[{ label: 'Retry', color: 'error', variant: 'outline', onClick: refresh }]"
        />

        <template v-if="snapshot">
          <div v-if="activeTab === 'controls'" class="space-y-4">
            <!-- Virtual Clock -->
            <HexClockControls
              :clock="snapshot.clock"
              :loading="loading"
              @advance="advanceClock"
              @reset="resetClock"
              @evaluate-slas="evaluateSlas"
            />

            <!-- Carrier Fault Injection -->
            <UCard :ui="{ body: 'space-y-3 p-4' }">
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-zap" class="size-4 text-warning" />
                  <span class="text-sm font-semibold">Simulated Carrier Fault Injection</span>
                </div>
                <USwitch
                  :model-value="snapshot.faults.outageEnabled"
                  label="Outage"
                  @update:model-value="toggleOutage"
                />
              </div>
              <p class="text-xs text-muted">
                Inject outages or transit delays into
                <code>SimulatedCarrierGatewayAdapter</code> without modifying domain code.
              </p>
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-xs text-muted">Transit Delay:</span>
                <UButton
                  v-for="h in [0, 4, 12, 24]"
                  :key="h"
                  size="xs"
                  :color="snapshot.faults.extraDelayHours === h ? 'warning' : 'neutral'"
                  :variant="snapshot.faults.extraDelayHours === h ? 'solid' : 'outline'"
                  @click="setExtraDelay(h)"
                >
                  +{{ h }}h
                </UButton>
              </div>
            </UCard>

            <!-- Active Adapters Matrix -->
            <UCard :ui="{ body: 'space-y-3 p-4' }">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-plug" class="size-4 text-primary" />
                <span class="text-sm font-semibold">Active Driven Adapters</span>
              </div>
              <dl class="divide-y divide-default rounded-md border border-default text-xs">
                <div class="flex items-center justify-between gap-2 px-3 py-2">
                  <dt class="shrink-0 text-muted">PersistencePort</dt>
                  <dd class="font-mono text-highlighted text-right break-all">{{ snapshot.adapters.persistence }}</dd>
                </div>
                <div class="flex items-center justify-between gap-2 px-3 py-2">
                  <dt class="text-muted">CarrierGatewayPort</dt>
                  <dd class="font-mono text-highlighted">{{ snapshot.adapters.carrier }}</dd>
                </div>
                <div class="flex items-center justify-between gap-2 px-3 py-2">
                  <dt class="text-muted">ClockPort</dt>
                  <dd class="font-mono text-highlighted">{{ snapshot.adapters.clock }}</dd>
                </div>
                <div class="flex items-center justify-between gap-2 px-3 py-2">
                  <dt class="text-muted">EventBusPort</dt>
                  <dd class="font-mono text-highlighted">{{ snapshot.adapters.eventBus }}</dd>
                </div>
                <div class="flex items-center justify-between gap-2 px-3 py-2">
                  <dt class="text-muted">AuditLogPort</dt>
                  <dd class="font-mono text-highlighted">{{ snapshot.adapters.auditLog }}</dd>
                </div>
              </dl>

              <div v-if="snapshot.modules.length" class="space-y-1.5">
                <p class="text-xs font-medium text-muted">
                  Registered Local Nuxt Modules
                </p>
                <div class="flex flex-wrap gap-1.5">
                  <UBadge
                    v-for="mod in snapshot.modules"
                    :key="mod.name"
                    color="primary"
                    variant="soft"
                    size="sm"
                  >
                    modules/{{ mod.name }} ({{ mod.boundedContext }})
                  </UBadge>
                </div>
              </div>
            </UCard>
          </div>

          <div v-else class="space-y-3">
            <div class="flex items-center justify-between text-xs text-muted">
              <span>Showing latest hexagonal use-case executions</span>
              <span class="tabular-nums">{{ snapshot.traces.length }} captured</span>
            </div>
            <HexCallTrace :traces="snapshot.traces" />
          </div>
        </template>
      </div>
    </template>
  </USlideover>
</template>
