<script setup lang="ts">
const {
  isOpen,
  snapshot,
  loading,
  refresh,
  advanceClock,
  resetClock,
  updateFaults,
  evaluateSlas,
} = useHexInspector()

const emit = defineEmits<{
  slasEvaluated: []
}>()

watch(isOpen, (open) => {
  if (open) {
    refresh()
  }
})

async function handleEvaluateSlas() {
  await evaluateSlas()
  emit('slasEvaluated')
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
      <div class="space-y-5">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <UBadge color="success" variant="subtle" icon="i-lucide-shield-check">
              Boundary Guard Healthy
            </UBadge>
            <UBadge v-if="snapshot" color="neutral" variant="outline">
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

        <template v-if="snapshot">
          <!-- Active Adapters Matrix -->
          <UCard :ui="{ body: 'space-y-2.5 p-4' }">
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-plug" class="size-4 text-primary" />
              <span class="text-sm font-semibold">Active Driven Adapters</span>
            </div>
            <dl class="grid grid-cols-1 gap-1.5 text-xs">
              <div class="flex items-center justify-between gap-2 rounded bg-elevated px-2.5 py-1.5">
                <dt class="text-muted">PersistencePort</dt>
                <dd class="font-mono text-highlighted truncate">{{ snapshot.adapters.persistence }}</dd>
              </div>
              <div class="flex items-center justify-between gap-2 rounded bg-elevated px-2.5 py-1.5">
                <dt class="text-muted">CarrierGatewayPort</dt>
                <dd class="font-mono text-highlighted">{{ snapshot.adapters.carrier }}</dd>
              </div>
              <div class="flex items-center justify-between gap-2 rounded bg-elevated px-2.5 py-1.5">
                <dt class="text-muted">ClockPort</dt>
                <dd class="font-mono text-highlighted">{{ snapshot.adapters.clock }}</dd>
              </div>
              <div class="flex items-center justify-between gap-2 rounded bg-elevated px-2.5 py-1.5">
                <dt class="text-muted">EventBusPort</dt>
                <dd class="font-mono text-highlighted">{{ snapshot.adapters.eventBus }}</dd>
              </div>
              <div class="flex items-center justify-between gap-2 rounded bg-elevated px-2.5 py-1.5">
                <dt class="text-muted">AuditLogPort</dt>
                <dd class="font-mono text-highlighted">{{ snapshot.adapters.auditLog }}</dd>
              </div>
            </dl>

            <div v-if="snapshot.modules.length" class="pt-2 space-y-1.5">
              <p class="text-[11px] font-medium uppercase tracking-wider text-muted">
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

          <!-- Virtual Clock -->
          <HexClockControls
            :clock="snapshot.clock"
            :loading="loading"
            @advance="advanceClock"
            @reset="resetClock"
            @evaluate-slas="handleEvaluateSlas"
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
              Inject outages or transit delays into <code>SimulatedCarrierGatewayAdapter</code> without modifying a single line of domain code.
            </p>
            <div class="flex items-center gap-2">
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

          <!-- Live Hexagonal Call Traces -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-activity" class="size-4 text-primary" />
                <span class="text-sm font-semibold">Live Hexagonal Call Traces</span>
              </div>
              <span class="text-xs text-muted">{{ snapshot.traces.length }} captured</span>
            </div>
            <HexCallTrace :traces="snapshot.traces" />
          </div>
        </template>
      </div>
    </template>
  </USlideover>
</template>
