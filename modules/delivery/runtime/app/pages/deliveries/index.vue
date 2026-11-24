<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type {
  CarrierModeDto,
  ShipmentDto,
  ShipmentStateDto,
} from '../../../../shared/types/delivery'

definePageMeta({
  title: 'Delivery & Dispatch (TMS)',
})

const { runTransition } = useDeliveries()
const { open: openInspector, evaluateSlas } = useHexInspector()

const [shipmentsQuery, availableCargoQuery] = await Promise.all([
  useDeliveryShipments(),
  useAvailableCargo(),
])

const shipments = computed(() => shipmentsQuery.data.value ?? [])
const availableCargo = computed(() => availableCargoQuery.data.value ?? [])
const loading = computed(() => shipmentsQuery.status.value === 'pending')
const loadError = computed(() => {
  const err = shipmentsQuery.error.value ?? availableCargoQuery.error.value
  return err ? formatApiError(err, 'Failed to load shipments').details : null
})

const searchQuery = shallowRef('')
const stateFilter = shallowRef<ShipmentStateDto | 'ALL'>('ALL')
const carrierFilter = shallowRef<CarrierModeDto | 'ALL'>('ALL')
const slaBreachedOnly = shallowRef(false)

const createModalOpen = shallowRef(false)
const timelineOpen = shallowRef(false)
const activeTimelineShipmentId = shallowRef<string | null>(null)

async function refreshDeliveries() {
  await Promise.all([shipmentsQuery.refresh(), availableCargoQuery.refresh()])
}

const summaryMetrics = computed(() => {
  let pendingDispatch = 0
  let inFlight = 0
  let slaBreached = 0
  for (const s of shipments.value) {
    if (s.state === 'PendingDispatch') {
      pendingDispatch += 1
    }
    if (!s.isTerminal) {
      inFlight += 1
    }
    if (s.slaBreached) {
      slaBreached += 1
    }
  }
  return {
    total: shipments.value.length,
    pendingDispatch,
    inFlight,
    slaBreached,
  }
})

const stateOptions: { label: string, value: ShipmentStateDto | 'ALL' }[] = [
  { label: 'All States', value: 'ALL' },
  { label: 'Pending Dispatch', value: 'PendingDispatch' },
  { label: 'Dispatched', value: 'Dispatched' },
  { label: 'In Transit', value: 'InTransit' },
  { label: 'Out For Delivery', value: 'OutForDelivery' },
  { label: 'Attempt Failed', value: 'DeliveryAttemptFailed' },
  { label: 'Delivered', value: 'Delivered' },
  { label: 'Returned to Warehouse', value: 'ReturnedToWarehouse' },
  { label: 'Cancelled', value: 'Cancelled' },
]

const carrierOptions: { label: string, value: CarrierModeDto | 'ALL' }[] = [
  { label: 'All Carriers', value: 'ALL' },
  { label: 'Standard Ground', value: 'STANDARD_GROUND' },
  { label: 'Express Air', value: 'EXPRESS_AIR' },
  { label: 'Cold-Chain Courier', value: 'COLD_CHAIN_COURIER' },
]

const filteredShipments = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return shipments.value.filter((s) => {
    if (stateFilter.value !== 'ALL' && s.state !== stateFilter.value) {
      return false
    }
    if (carrierFilter.value !== 'ALL' && s.carrierMode !== carrierFilter.value) {
      return false
    }
    if (slaBreachedOnly.value && !s.slaBreached) {
      return false
    }
    if (q) {
      const matchesQuery = s.trackingNumber.toLowerCase().includes(q)
        || s.destination.toLowerCase().includes(q)
        || s.cargoSummary.label.toLowerCase().includes(q)
        || (s.carrierReference?.toLowerCase().includes(q) ?? false)
      if (!matchesQuery) {
        return false
      }
    }
    return true
  })
})

const stateColors: Record<ShipmentStateDto, 'neutral' | 'info' | 'primary' | 'warning' | 'success' | 'error'> = {
  PendingDispatch: 'neutral',
  Dispatched: 'info',
  InTransit: 'primary',
  OutForDelivery: 'primary',
  DeliveryAttemptFailed: 'warning',
  Delivered: 'success',
  ReturnedToWarehouse: 'error',
  Cancelled: 'neutral',
}

const stateLabels: Record<ShipmentStateDto, string> = {
  PendingDispatch: 'Pending dispatch',
  Dispatched: 'Dispatched',
  InTransit: 'In transit',
  OutForDelivery: 'Out for delivery',
  DeliveryAttemptFailed: 'Attempt failed',
  Delivered: 'Delivered',
  ReturnedToWarehouse: 'Returned',
  Cancelled: 'Cancelled',
}

type ShipmentAction = 'dispatch' | 'advance' | 'deliver' | 'fail-attempt' | 'cancel'

function primaryAction(s: ShipmentDto): { action: ShipmentAction, label: string, icon: string, color: 'primary' | 'success' } | null {
  switch (s.state) {
    case 'PendingDispatch':
      return { action: 'dispatch', label: 'Dispatch', icon: 'i-lucide-send', color: 'primary' }
    case 'Dispatched':
      return { action: 'advance', label: 'Mark in transit', icon: 'i-lucide-truck', color: 'primary' }
    case 'InTransit':
      return { action: 'advance', label: 'Out for delivery', icon: 'i-lucide-package-open', color: 'primary' }
    case 'OutForDelivery':
      return { action: 'deliver', label: 'Deliver', icon: 'i-lucide-check', color: 'success' }
    case 'DeliveryAttemptFailed':
      return { action: 'advance', label: 'Re-attempt', icon: 'i-lucide-rotate-cw', color: 'primary' }
    default:
      return null
  }
}

function secondaryActions(s: ShipmentDto) {
  const items: { label: string, icon: string, color?: 'error' | 'warning', onSelect: () => void }[] = []
  if (s.state === 'DeliveryAttemptFailed') {
    items.push({ label: 'Mark delivered', icon: 'i-lucide-check', onSelect: () => handleAction(s, 'deliver') })
  }
  if (s.state === 'OutForDelivery' || s.state === 'DeliveryAttemptFailed') {
    items.push({ label: 'Record failed attempt', icon: 'i-lucide-triangle-alert', color: 'warning', onSelect: () => handleAction(s, 'fail-attempt') })
  }
  if (!s.isTerminal) {
    items.push({ label: 'Cancel shipment', icon: 'i-lucide-ban', color: 'error', onSelect: () => handleAction(s, 'cancel') })
  }
  return [items]
}

const carrierLabels: Record<CarrierModeDto, string> = {
  STANDARD_GROUND: 'GROUND',
  EXPRESS_AIR: 'EXPRESS AIR',
  COLD_CHAIN_COURIER: 'COLD CHAIN',
}

const columns: TableColumn<ShipmentDto>[] = [
  { accessorKey: 'trackingNumber', header: 'Tracking #' },
  { accessorKey: 'destination', header: 'Destination & Cargo' },
  { accessorKey: 'carrierMode', header: 'Carrier' },
  { accessorKey: 'state', header: 'State' },
  { accessorKey: 'slaBreached', header: 'SLA' },
  { accessorKey: 'quotedCostFormatted', header: 'Quote' },
  { id: 'actions', header: () => h('div', { class: 'text-right' }, 'Actions') },
]

function openTimeline(shipmentId: string) {
  activeTimelineShipmentId.value = shipmentId
  timelineOpen.value = true
}

function resetFilters() {
  searchQuery.value = ''
  stateFilter.value = 'ALL'
  carrierFilter.value = 'ALL'
  slaBreachedOnly.value = false
}

async function handleAction(
  shipment: ShipmentDto,
  action: ShipmentAction,
) {
  try {
    if (action === 'fail-attempt') {
      await runTransition(shipment.id, 'fail-attempt', { reason: 'Recipient unavailable at loading bay' })
    }
    else {
      await runTransition(shipment.id, action)
    }
  }
  catch {
    // Domain rejection toast is surfaced automatically by useDeliveries()
  }
}
</script>

<template>
  <UDashboardPanel id="deliveries-panel" class="min-w-0">
    <template #header>
      <UDashboardNavbar title="Delivery & Dispatch (TMS)" icon="i-lucide-truck">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            size="sm"
            color="neutral"
            variant="outline"
            icon="i-lucide-radar"
            @click="evaluateSlas"
          >
            Evaluate SLAs
          </UButton>
          <UButton
            size="sm"
            color="neutral"
            variant="outline"
            icon="i-lucide-microscope"
            @click="openInspector"
          >
            Inspector
          </UButton>
          <UButton
            size="sm"
            color="primary"
            icon="i-lucide-plus"
            @click="createModalOpen = true"
          >
            Create Shipment
          </UButton>
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <template #left>
          <div class="flex flex-wrap items-center gap-2">
            <UInput
              v-model="searchQuery"
              icon="i-lucide-search"
              placeholder="Search tracking, destination, cargo..."
              size="xs"
              class="w-48 sm:w-56"
            />
            <USelect
              v-model="stateFilter"
              :items="stateOptions"
              value-key="value"
              size="xs"
              class="w-36"
            />
            <USelect
              v-model="carrierFilter"
              :items="carrierOptions"
              value-key="value"
              size="xs"
              class="w-36"
            />
            <UCheckbox
              v-model="slaBreachedOnly"
              label="SLA Breached only"
              size="sm"
            />
          </div>
        </template>
        <template #right>
          <UButton
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-refresh-cw"
            :loading="loading"
            @click="refreshDeliveries"
          >
            Refresh
          </UButton>
        </template>
      </UDashboardToolbar>
    </template>

    <template #body>
      <div class="mx-auto w-full min-w-0 max-w-[1440px] space-y-5">
        <UAlert
          v-if="loadError"
          color="error"
          variant="subtle"
          icon="i-lucide-alert-circle"
          title="Unable to load shipments"
          :description="loadError"
          :actions="[{ label: 'Retry', color: 'error', variant: 'outline', onClick: refreshDeliveries }]"
        />

        <!-- Compact Operational Telemetry Strip -->
        <section
          aria-label="Delivery Fleet Summary"
          class="grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-default rounded-lg border border-default bg-elevated/30"
        >
          <div class="p-3.5 sm:p-4">
            <p class="text-xs text-muted">Total Shipments</p>
            <p class="mt-1 text-2xl font-semibold tabular-nums text-highlighted">{{ summaryMetrics.total }}</p>
          </div>
          <div class="p-3.5 sm:p-4">
            <p class="text-xs text-muted">Pending Dispatch</p>
            <p class="mt-1 text-2xl font-semibold tabular-nums text-highlighted">{{ summaryMetrics.pendingDispatch }}</p>
          </div>
          <div class="p-3.5 sm:p-4">
            <p class="text-xs text-muted">Active In Flight</p>
            <p class="mt-1 text-2xl font-semibold tabular-nums text-info">{{ summaryMetrics.inFlight }}</p>
          </div>
          <button
            type="button"
            class="w-full flex flex-col items-start justify-between p-3.5 sm:p-4 text-left transition-colors hover:bg-elevated/60"
            @click="slaBreachedOnly = !slaBreachedOnly"
          >
            <div class="flex items-center justify-between w-full">
              <p class="text-xs text-muted">SLA Breached</p>
              <span class="text-[11px] text-primary">{{ slaBreachedOnly ? 'Showing breached' : 'Filter' }}</span>
            </div>
            <p
              class="mt-1 text-2xl font-semibold tabular-nums"
              :class="summaryMetrics.slaBreached > 0 ? 'text-error' : 'text-highlighted'"
            >
              {{ summaryMetrics.slaBreached }}
            </p>
          </button>
        </section>

        <UCard :ui="{ body: 'p-0 overflow-x-auto' }">
          <UTable
            :data="filteredShipments"
            :columns="columns"
            :loading="loading"
            :ui="{ th: 'px-2.5 py-2.5 text-xs whitespace-nowrap', td: 'px-2.5 py-2.5' }"
          >
            <template #trackingNumber-cell="{ row }">
              <div class="space-y-0.5">
                <button
                  type="button"
                  class="font-mono text-xs font-semibold text-primary hover:underline whitespace-nowrap"
                  @click="openTimeline(row.original.id)"
                >
                  {{ row.original.trackingNumber }}
                </button>
                <p class="font-mono text-[11px] text-muted tabular-nums whitespace-nowrap">
                  {{ row.original.originBinCode }}<span v-if="row.original.carrierReference"> • {{ row.original.carrierReference }}</span>
                </p>
              </div>
            </template>

            <template #destination-cell="{ row }">
              <div class="space-y-0.5 max-w-52">
                <p class="truncate text-xs font-medium text-highlighted">{{ row.original.destination }}</p>
                <p class="truncate text-[11px] text-muted tabular-nums">
                  {{ row.original.cargoSummary.label }} ({{ row.original.cargoSummary.handlingClass }} • {{ row.original.cargoSummary.weightKg }}kg)
                </p>
              </div>
            </template>

            <template #carrierMode-cell="{ row }">
              <UBadge color="neutral" variant="outline" size="xs" class="whitespace-nowrap">
                {{ carrierLabels[row.original.carrierMode] }}
              </UBadge>
            </template>

            <template #state-cell="{ row }">
              <div class="flex items-center gap-1.5">
                <UBadge :color="stateColors[row.original.state]" variant="subtle" size="md" class="whitespace-nowrap">
                  {{ stateLabels[row.original.state] }}
                </UBadge>
                <span v-if="row.original.attemptCount > 0" class="font-mono text-xs text-warning tabular-nums">
                  ({{ row.original.attemptCount }}/3)
                </span>
              </div>
            </template>

            <template #slaBreached-cell="{ row }">
              <div class="space-y-0.5 text-xs">
                <UBadge
                  v-if="row.original.slaBreached"
                  color="error"
                  variant="solid"
                  size="xs"
                  icon="i-lucide-alert-triangle"
                >
                  SLA Breached
                </UBadge>
                <UBadge
                  v-else-if="row.original.state === 'Delivered'"
                  color="success"
                  variant="soft"
                  size="xs"
                >
                  Met On-Time
                </UBadge>
                <UBadge
                  v-else-if="row.original.state === 'Cancelled' || row.original.state === 'ReturnedToWarehouse'"
                  color="neutral"
                  variant="soft"
                  size="xs"
                >
                  Closed
                </UBadge>
                <span v-else class="font-mono text-[11px] text-muted tabular-nums">
                  {{ row.original.remainingHours >= 0 ? `${row.original.remainingHours}h left` : `${Math.abs(row.original.remainingHours)}h overdue` }}
                </span>
              </div>
            </template>

            <template #quotedCostFormatted-cell="{ row }">
              <span class="font-mono text-xs font-medium text-highlighted tabular-nums">
                {{ row.original.quotedCostFormatted }}
              </span>
            </template>

            <template #actions-cell="{ row }">
              <div class="flex items-center justify-end gap-1">
                <UButton
                  v-if="primaryAction(row.original)"
                  size="xs"
                  :color="primaryAction(row.original)!.color"
                  variant="soft"
                  :icon="primaryAction(row.original)!.icon"
                  class="whitespace-nowrap"
                  @click="handleAction(row.original, primaryAction(row.original)!.action)"
                >
                  {{ primaryAction(row.original)!.label }}
                </UButton>
                <UDropdownMenu
                  v-if="secondaryActions(row.original)[0]!.length"
                  :items="secondaryActions(row.original)"
                  :content="{ align: 'end' }"
                >
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-ellipsis"
                    aria-label="More actions"
                  />
                </UDropdownMenu>
                <UTooltip text="View domain event timeline">
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-history"
                    aria-label="Timeline"
                    @click="openTimeline(row.original.id)"
                  />
                </UTooltip>
              </div>
            </template>

            <template #empty>
              <UEmpty
                variant="naked"
                size="sm"
                icon="i-lucide-truck"
                title="No shipments match the active filters"
                description="Reset filters or create a new shipment from available warehouse stock."
                :actions="[{ label: 'Reset filters', color: 'neutral', variant: 'outline', onClick: resetFilters }]"
              />
            </template>
          </UTable>
        </UCard>

        <UAlert
          color="neutral"
          variant="subtle"
          icon="i-lucide-lightbulb"
          title="Try the Hexagonal Domain Guards live"
          description="Click 'Cancel' on a Dispatched/InTransit shipment to see CannotCancelDispatchedShipmentError (409), click 'Fail Attempt' on LOG-2026-ATT505 (2/3 attempts) to watch DeliveryExceptionChain trigger ShipmentReturnedToWarehouse -> Warehouse auto-restock, or advance the Virtual Clock +12h in the Inspector and run Evaluate SLAs."
        />
      </div>

      <LazyDeliveryCreateShipmentModal
        v-if="createModalOpen"
        v-model:open="createModalOpen"
        :available-cargo="availableCargo"
      />

      <LazyDeliveryTimelineSlideover
        v-if="timelineOpen"
        v-model:open="timelineOpen"
        :shipment-id="activeTimelineShipmentId"
      />
    </template>
  </UDashboardPanel>
</template>
