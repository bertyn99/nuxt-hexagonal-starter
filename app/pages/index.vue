<script setup lang="ts">
import type { ChartData } from '@nuxt/ui'

definePageMeta({
  title: 'Operations Overview',
})

const { open: openInspector } = useHexInspector()

const [utilizationQuery, shipmentsQuery, inspectorQuery] = await Promise.all([
  useWarehouseUtilization(),
  useDeliveryShipments(),
  useHexInspectorSnapshot(),
])

const utilization = computed(() => utilizationQuery.data.value ?? null)
const shipments = computed(() => shipmentsQuery.data.value ?? [])
const snapshot = computed(() => inspectorQuery.data.value ?? null)

const refreshing = computed(() =>
  utilizationQuery.status.value === 'pending'
  || shipmentsQuery.status.value === 'pending'
  || inspectorQuery.status.value === 'pending',
)

const loadError = computed(() => {
  const err = utilizationQuery.error.value ?? shipmentsQuery.error.value ?? inspectorQuery.error.value
  return err ? formatApiError(err, 'Failed to load overview metrics').details : null
})

async function refreshAll() {
  await Promise.all([
    utilizationQuery.refresh(),
    shipmentsQuery.refresh(),
    inspectorQuery.refresh(),
  ])
}

const activeShipmentsCount = computed(() =>
  shipments.value.filter(s => !s.isTerminal).length,
)

const slaBreachCount = computed(() =>
  shipments.value.filter(s => s.slaBreached).length,
)

const onTimeRatePercent = computed(() => {
  if (shipments.value.length === 0) {
    return 100
  }
  const onTime = shipments.value.filter(s => !s.slaBreached).length
  return Math.round((onTime / shipments.value.length) * 100)
})

const zoneChartData = computed<ChartData[]>(() => {
  if (!utilization.value) {
    return []
  }
  return utilization.value.byZone.map(z => ({
    zone: z.zone.replace('_', ' '),
    utilization: z.utilizationPercent,
    usedWeight: Math.round(z.usedWeightKg),
  }))
})

const lifecycleBreakdown = computed(() => {
  const counts = {
    active: 0,
    delivered: 0,
    exception: 0,
    cancelled: 0,
  }
  for (const s of shipments.value) {
    if (s.state === 'Delivered') {
      counts.delivered += 1
    }
    else if (s.state === 'Cancelled') {
      counts.cancelled += 1
    }
    else if (s.state === 'DeliveryAttemptFailed' || s.state === 'ReturnedToWarehouse' || s.slaBreached) {
      counts.exception += 1
    }
    else {
      counts.active += 1
    }
  }
  return counts
})

const shipmentDistributionData = computed<ChartData[]>(() => [
  { status: 'Active Transit', count: lifecycleBreakdown.value.active },
  { status: 'Delivered', count: lifecycleBreakdown.value.delivered },
  { status: 'Exceptions / SLA', count: lifecycleBreakdown.value.exception },
])

const eventFilter = shallowRef<'all' | 'warehouse' | 'delivery'>('all')
const eventTabs = [
  { label: 'All Events', value: 'all' },
  { label: 'Warehouse', value: 'warehouse' },
  { label: 'Delivery', value: 'delivery' },
]

const filteredEvents = computed(() => {
  const list = snapshot.value?.recentEvents ?? []
  const scoped = eventFilter.value === 'all'
    ? list
    : list.filter(ev => ev.boundedContext === eventFilter.value)
  return scoped.slice(0, 12)
})

const topologyItems = [
  {
    path: 'modules/hexagonal-kernel/',
    role: 'Shared Platform',
    badgeColor: 'neutral' as const,
    summary: 'Pure domain primitives (Entity, AggregateRoot, DomainError), EventBusPort, ClockPort, TracingUseCaseDecorator, and build-time boundary guard.',
  },
  {
    path: 'modules/warehouse/',
    role: 'Bounded Context A',
    badgeColor: 'primary' as const,
    summary: 'WarehouseBin aggregate, Composite CargoUnit (Parcel/Pallet), StorageAllocationChain (Zone → Weight → Volume), and swappable SQLite/Memory adapters.',
  },
  {
    path: 'modules/delivery/',
    role: 'Bounded Context B',
    badgeColor: 'info' as const,
    summary: 'Shipment State Machine, CarrierStrategy pricing, DeliveryExceptionChain (3-attempt return), and LocalWarehouseStockAdapter ACL.',
  },
]
</script>

<template>
  <UDashboardPanel id="overview-panel" class="min-w-0">
    <template #header>
      <UDashboardNavbar title="Operations Overview" icon="i-lucide-layout-dashboard">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            size="sm"
            color="neutral"
            variant="ghost"
            icon="i-lucide-refresh-cw"
            :loading="refreshing"
            @click="refreshAll"
          >
            Refresh
          </UButton>
          <UButton
            size="sm"
            color="primary"
            variant="soft"
            icon="i-lucide-microscope"
            @click="openInspector"
          >
            Inspector
          </UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mx-auto max-w-[1440px] space-y-6">
        <UAlert
          v-if="loadError"
          color="error"
          variant="subtle"
          icon="i-lucide-alert-circle"
          title="Unable to load live overview data"
          :description="loadError"
          :actions="[{ label: 'Retry', color: 'error', variant: 'outline', onClick: refreshAll }]"
        />

        <!-- Unified 4-Column Telemetry Strip -->
        <section
          aria-label="Key Operational Metrics"
          class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-default rounded-lg border border-default bg-elevated/30"
        >
          <div class="p-4 sm:p-5 flex flex-col justify-between gap-2">
            <div class="flex items-center justify-between text-xs text-muted">
              <span class="font-medium">Warehouse Utilization</span>
              <UIcon name="i-lucide-warehouse" class="size-4 text-primary" />
            </div>
            <div>
              <p class="text-3xl font-semibold tracking-tight tabular-nums text-highlighted">
                {{ utilization?.overallUtilizationPercent ?? 0 }}%
              </p>
              <p class="mt-1 text-xs text-muted tabular-nums">
                {{ utilization?.totalCargoUnits ?? 0 }} cargo units across {{ utilization?.totalBins ?? 0 }} bins
              </p>
            </div>
          </div>

          <div class="p-4 sm:p-5 flex flex-col justify-between gap-2">
            <div class="flex items-center justify-between text-xs text-muted">
              <span class="font-medium">Active Shipments</span>
              <UIcon name="i-lucide-truck" class="size-4 text-info" />
            </div>
            <div>
              <p class="text-3xl font-semibold tracking-tight tabular-nums text-highlighted">
                {{ activeShipmentsCount }}
              </p>
              <p class="mt-1 text-xs text-muted tabular-nums">
                {{ shipments.length }} total shipments tracked
              </p>
            </div>
          </div>

          <div class="p-4 sm:p-5 flex flex-col justify-between gap-2">
            <div class="flex items-center justify-between text-xs text-muted">
              <span class="font-medium">On-Time SLA Rate</span>
              <UIcon name="i-lucide-shield-check" class="size-4 text-success" />
            </div>
            <div>
              <p class="text-3xl font-semibold tracking-tight tabular-nums text-success">
                {{ onTimeRatePercent }}%
              </p>
              <p class="mt-1 text-xs text-muted">
                Deterministic ClockPort window
              </p>
            </div>
          </div>

          <div class="p-4 sm:p-5 flex flex-col justify-between gap-2">
            <div class="flex items-center justify-between text-xs text-muted">
              <span class="font-medium">Active SLA Breaches</span>
              <UIcon
                name="i-lucide-alarm-clock-off"
                class="size-4"
                :class="slaBreachCount > 0 ? 'text-error' : 'text-muted'"
              />
            </div>
            <div>
              <p
                class="text-3xl font-semibold tracking-tight tabular-nums"
                :class="slaBreachCount > 0 ? 'text-error' : 'text-highlighted'"
              >
                {{ slaBreachCount }}
              </p>
              <p class="mt-1 text-xs text-muted">
                {{ slaBreachCount > 0 ? 'Requires immediate dispatch review' : 'All active SLAs within window' }}
              </p>
            </div>
          </div>
        </section>

        <!-- Asymmetric Analytics Grid (7 / 5) -->
        <section class="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <UCard class="lg:col-span-7">
            <template #header>
              <div class="flex items-center justify-between gap-3">
                <div>
                  <h2 class="text-sm font-semibold text-highlighted">
                    Warehouse Utilization by Zone (%)
                  </h2>
                  <p class="text-xs text-muted">
                    Peak weight or volume load per bounded storage zone
                  </p>
                </div>
                <UButton size="xs" color="neutral" variant="outline" to="/warehouse" trailing-icon="i-lucide-arrow-right">
                  Open WMS
                </UButton>
              </div>
            </template>

            <ClientOnly>
              <UChart
                v-if="zoneChartData.length > 0"
                type="bar"
                :data="zoneChartData"
                index="zone"
                :categories="[{ key: 'utilization', label: 'Utilization %', color: 'primary' }]"
                :height="230"
                aria-label="Warehouse utilization percentage by storage zone"
              />
              <div v-else class="grid grid-cols-3 gap-3 py-8">
                <USkeleton v-for="n in 3" :key="n" class="h-32 w-full" />
              </div>
              <template #fallback>
                <USkeleton class="h-[230px] w-full" />
              </template>
            </ClientOnly>
          </UCard>

          <UCard class="lg:col-span-5">
            <template #header>
              <div class="flex items-center justify-between gap-3">
                <div>
                  <h2 class="text-sm font-semibold text-highlighted">
                    Shipment Status Breakdown
                  </h2>
                  <p class="text-xs text-muted">
                    Current TMS lifecycle distribution
                  </p>
                </div>
                <UButton size="xs" color="neutral" variant="outline" to="/deliveries" trailing-icon="i-lucide-arrow-right">
                  Open TMS
                </UButton>
              </div>
            </template>

            <div class="space-y-4">
              <ClientOnly>
                <UChart
                  v-if="shipments.length > 0"
                  type="donut"
                  :data="shipmentDistributionData"
                  index="status"
                  :categories="[{ key: 'count', label: 'Shipments' }]"
                  :colors="['info', 'success', 'error']"
                  :height="175"
                  aria-label="Shipment breakdown by lifecycle status"
                />
                <template #fallback>
                  <USkeleton class="h-[175px] w-full" />
                </template>
              </ClientOnly>
              <div class="grid grid-cols-3 divide-x divide-default border-t border-default pt-3 text-center">
                <div>
                  <p class="text-xs text-muted">In Flight</p>
                  <p class="text-sm font-semibold tabular-nums text-info">{{ lifecycleBreakdown.active }}</p>
                </div>
                <div>
                  <p class="text-xs text-muted">Delivered</p>
                  <p class="text-sm font-semibold tabular-nums text-success">{{ lifecycleBreakdown.delivered }}</p>
                </div>
                <div>
                  <p class="text-xs text-muted">Exceptions</p>
                  <p class="text-sm font-semibold tabular-nums text-error">{{ lifecycleBreakdown.exception }}</p>
                </div>
              </div>
            </div>
          </UCard>
        </section>

        <!-- Asymmetric Topology (5) & Live Domain Events (7) -->
        <section class="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div class="lg:col-span-5 rounded-lg border border-default bg-default p-4 sm:p-5 flex flex-col justify-between">
            <div class="space-y-4">
              <div class="flex items-center justify-between gap-2">
                <h2 class="text-sm font-semibold text-highlighted">
                  Modular Monolith Topology
                </h2>
                <UBadge color="success" variant="subtle" size="xs" icon="i-lucide-shield-check">
                  Boundary Guard Active
                </UBadge>
              </div>

              <div class="divide-y divide-default border-t border-default">
                <div
                  v-for="item in topologyItems"
                  :key="item.path"
                  class="py-3.5 first:pt-3.5 last:pb-0 space-y-1.5"
                >
                  <div class="flex items-center justify-between gap-2">
                    <span class="font-mono text-xs font-semibold text-highlighted">{{ item.path }}</span>
                    <UBadge :color="item.badgeColor" variant="subtle" size="xs">{{ item.role }}</UBadge>
                  </div>
                  <p class="text-xs leading-relaxed text-muted">
                    {{ item.summary }}
                  </p>
                </div>
              </div>
            </div>

            <div class="mt-4 pt-3 border-t border-default flex items-center justify-between text-xs text-muted">
              <span>Live traces captured: <strong class="tabular-nums text-highlighted">{{ snapshot?.traces.length ?? 0 }}</strong></span>
              <UButton size="xs" color="neutral" variant="ghost" trailing-icon="i-lucide-arrow-up-right" @click="openInspector">
                Inspect Ports
              </UButton>
            </div>
          </div>

          <UCard class="lg:col-span-7" :ui="{ body: 'p-0' }">
            <template #header>
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="flex items-center gap-2">
                  <h2 class="text-sm font-semibold text-highlighted">
                    Recent Domain Events (AuditLogPort)
                  </h2>
                  <UBadge color="neutral" variant="subtle" size="xs" class="tabular-nums">
                    {{ snapshot?.recentEvents.length ?? 0 }} events
                  </UBadge>
                </div>

                <UTabs
                  v-model="eventFilter"
                  :items="eventTabs"
                  :content="false"
                  size="xs"
                  color="neutral"
                />
              </div>
            </template>

            <div v-if="filteredEvents.length > 0" class="divide-y divide-default max-h-80 overflow-y-auto px-4 sm:px-5">
              <div
                v-for="ev in filteredEvents"
                :key="ev.id"
                class="py-2.5 text-xs space-y-1"
              >
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2 min-w-0">
                    <UBadge
                      :color="ev.boundedContext === 'warehouse' ? 'primary' : 'info'"
                      variant="soft"
                      size="xs"
                    >
                      {{ ev.boundedContext }}
                    </UBadge>
                    <span class="truncate font-mono font-medium text-highlighted">{{ ev.eventName }}</span>
                  </div>
                  <NuxtTime
                    :datetime="ev.occurredAt"
                    hour="2-digit"
                    minute="2-digit"
                    second="2-digit"
                    class="shrink-0 font-mono text-[11px] text-dimmed"
                  />
                </div>
                <p class="text-muted leading-relaxed">{{ ev.summary }}</p>
              </div>
            </div>

            <div v-else class="p-4">
              <UEmpty
                variant="naked"
                size="sm"
                icon="i-lucide-radio"
                title="No domain events in this scope"
                description="Trigger a Warehouse or Delivery command to publish domain events onto EventBusPort."
              />
            </div>
          </UCard>
        </section>
      </div>
    </template>
  </UDashboardPanel>
</template>
