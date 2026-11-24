<script setup lang="ts">
import type { ChartData } from '@nuxt/ui'

definePageMeta({
  title: 'Operations Overview',
})

const { bins, utilization, fetchAll: fetchWarehouse } = useWarehouse()
const { shipments, fetchShipments } = useDeliveries()
const { snapshot, refresh: refreshInspector, open: openInspector } = useHexInspector()

const refreshing = ref(false)

async function loadAll() {
  refreshing.value = true
  try {
    await Promise.all([fetchWarehouse(), fetchShipments(), refreshInspector()])
  }
  finally {
    refreshing.value = false
  }
}

await useAsyncData('overview-init', async () => {
  await loadAll()
  return true
})

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

const shipmentDistributionData = computed<ChartData[]>(() => {
  const counts = {
    Active: 0,
    Delivered: 0,
    Exception: 0,
  }
  for (const s of shipments.value) {
    if (s.state === 'Delivered') {
      counts.Delivered += 1
    }
    else if (s.state === 'DeliveryAttemptFailed' || s.state === 'ReturnedToWarehouse' || s.slaBreached) {
      counts.Exception += 1
    }
    else if (s.state !== 'Cancelled') {
      counts.Active += 1
    }
  }
  return [
    { status: 'Active Transit', count: counts.Active },
    { status: 'Delivered', count: counts.Delivered },
    { status: 'Exceptions / SLA', count: counts.Exception },
  ]
})
</script>

<template>
  <UDashboardPanel id="overview-panel">
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
            @click="loadAll"
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
            Architecture Inspector
          </UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <!-- KPI Cards -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <UCard>
            <div class="flex items-center justify-between">
              <p class="text-xs font-medium text-muted">Warehouse Utilization</p>
              <UIcon name="i-lucide-warehouse" class="size-4 text-primary" />
            </div>
            <p class="mt-2 text-3xl font-bold text-highlighted">
              {{ utilization?.overallUtilizationPercent ?? 0 }}%
            </p>
            <p class="mt-1 text-xs text-muted">
              {{ utilization?.totalCargoUnits ?? 0 }} cargo units across {{ bins.length }} bins
            </p>
          </UCard>

          <UCard>
            <div class="flex items-center justify-between">
              <p class="text-xs font-medium text-muted">Active Shipments</p>
              <UIcon name="i-lucide-truck" class="size-4 text-info" />
            </div>
            <p class="mt-2 text-3xl font-bold text-highlighted">
              {{ activeShipmentsCount }}
            </p>
            <p class="mt-1 text-xs text-muted">
              {{ shipments.length }} total shipments tracked
            </p>
          </UCard>

          <UCard>
            <div class="flex items-center justify-between">
              <p class="text-xs font-medium text-muted">On-Time SLA Rate</p>
              <UIcon name="i-lucide-shield-check" class="size-4 text-success" />
            </div>
            <p class="mt-2 text-3xl font-bold text-success">
              {{ onTimeRatePercent }}%
            </p>
            <p class="mt-1 text-xs text-muted">
              Evaluated deterministically via ClockPort
            </p>
          </UCard>

          <UCard>
            <div class="flex items-center justify-between">
              <p class="text-xs font-medium text-muted">Active SLA Breaches</p>
              <UIcon
                name="i-lucide-alarm-clock-off"
                class="size-4"
                :class="slaBreachCount > 0 ? 'text-error' : 'text-muted'"
              />
            </div>
            <p
              class="mt-2 text-3xl font-bold"
              :class="slaBreachCount > 0 ? 'text-error' : 'text-highlighted'"
            >
              {{ slaBreachCount }}
            </p>
            <p class="mt-1 text-xs text-muted">
              Advance Virtual Clock in Inspector to simulate
            </p>
          </UCard>
        </div>

        <!-- Charts Row -->
        <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <div>
                  <h2 class="text-sm font-semibold text-highlighted">
                    Warehouse Utilization by Zone (%)
                  </h2>
                  <p class="text-xs text-muted">
                    Aggregated from <code>modules/warehouse/</code>
                  </p>
                </div>
                <UButton size="xs" color="neutral" variant="ghost" to="/warehouse" trailing-icon="i-lucide-arrow-right">
                  Open WMS
                </UButton>
              </div>
            </template>

            <UChart
              v-if="zoneChartData.length > 0"
              type="bar"
              :data="zoneChartData"
              index="zone"
              :categories="[{ key: 'utilization', label: 'Utilization %', color: 'primary' }]"
              :height="220"
              aria-label="Warehouse utilization percentage by storage zone"
            />
          </UCard>

          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <div>
                  <h2 class="text-sm font-semibold text-highlighted">
                    Shipment Status Breakdown
                  </h2>
                  <p class="text-xs text-muted">
                    Aggregated from <code>modules/delivery/</code>
                  </p>
                </div>
                <UButton size="xs" color="neutral" variant="ghost" to="/deliveries" trailing-icon="i-lucide-arrow-right">
                  Open TMS
                </UButton>
              </div>
            </template>

            <UChart
              v-if="shipmentDistributionData.length > 0"
              type="donut"
              :data="shipmentDistributionData"
              index="status"
              :categories="[{ key: 'count', label: 'Shipments' }]"
              :colors="['info', 'success', 'error']"
              :height="220"
              aria-label="Shipment breakdown by lifecycle status"
            />
          </UCard>
        </div>

        <!-- Architecture & Recent Domain Events -->
        <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <h2 class="text-sm font-semibold text-highlighted">
                  Modular Monolith Topology
                </h2>
                <UBadge color="success" variant="subtle" size="xs">
                  4-Layer Guard Active
                </UBadge>
              </div>
            </template>

            <div class="space-y-3 text-xs">
              <div class="rounded-lg border border-default p-3 space-y-1">
                <div class="flex items-center justify-between">
                  <span class="font-mono font-semibold text-highlighted">modules/hexagonal-kernel/</span>
                  <UBadge color="neutral" variant="outline" size="xs">Shared Platform</UBadge>
                </div>
                <p class="text-muted">
                  Pure domain primitives (Entity, AggregateRoot, ValueObject, DomainEvent, DomainError), EventBusPort, ClockPort, TracingUseCaseDecorator, and build-time boundary guard.
                </p>
              </div>

              <div class="rounded-lg border border-default p-3 space-y-1">
                <div class="flex items-center justify-between">
                  <span class="font-mono font-semibold text-highlighted">modules/warehouse/</span>
                  <UBadge color="primary" variant="subtle" size="xs">Bounded Context A</UBadge>
                </div>
                <p class="text-muted">
                  WarehouseBin aggregate, Composite CargoUnit (Parcel/Pallet), StorageAllocationChain (Zone → Weight → Volume), and swappable InMemory/DrizzleSqlite adapters.
                </p>
              </div>

              <div class="rounded-lg border border-default p-3 space-y-1">
                <div class="flex items-center justify-between">
                  <span class="font-mono font-semibold text-highlighted">modules/delivery/</span>
                  <UBadge color="info" variant="subtle" size="xs">Bounded Context B</UBadge>
                </div>
                <p class="text-muted">
                  Shipment State Machine, CarrierStrategy pricing, DeliveryExceptionChain (3-attempt return), and LocalWarehouseStockAdapter (Anti-Corruption Layer).
                </p>
              </div>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <h2 class="text-sm font-semibold text-highlighted">
                  Recent Domain Events (AuditLogPort)
                </h2>
                <UBadge color="neutral" variant="subtle" size="xs">
                  {{ snapshot?.recentEvents.length ?? 0 }} events
                </UBadge>
              </div>
            </template>

            <div v-if="snapshot && snapshot.recentEvents.length > 0" class="divide-y divide-default max-h-72 overflow-y-auto">
              <div
                v-for="ev in snapshot.recentEvents.slice(0, 10)"
                :key="ev.id"
                class="py-2 first:pt-0 last:pb-0 text-xs space-y-0.5"
              >
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-1.5">
                    <UBadge
                      :color="ev.boundedContext === 'warehouse' ? 'primary' : 'info'"
                      variant="soft"
                      size="xs"
                    >
                      {{ ev.boundedContext }}
                    </UBadge>
                    <span class="font-mono font-medium text-highlighted">{{ ev.eventName }}</span>
                  </div>
                  <span class="font-mono text-[10px] text-dimmed">
                    {{ new Date(ev.occurredAt).toLocaleTimeString() }}
                  </span>
                </div>
                <p class="text-muted">{{ ev.summary }}</p>
              </div>
            </div>
            <p v-else class="text-xs text-muted">
              No domain events published yet.
            </p>
          </UCard>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
