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

const {
  shipments,
  availableCargo,
  loading,
  fetchShipments,
  fetchAvailableCargo,
  runTransition,
} = useDeliveries()

const { open: openInspector, evaluateSlas } = useHexInspector()

const stateFilter = ref<ShipmentStateDto | 'ALL'>('ALL')
const carrierFilter = ref<CarrierModeDto | 'ALL'>('ALL')
const slaBreachedOnly = ref(false)

const createModalOpen = ref(false)
const timelineOpen = ref(false)
const activeTimelineShipmentId = ref<string | null>(null)

await useAsyncData('deliveries-page-init', async () => {
  await Promise.all([fetchShipments(), fetchAvailableCargo()])
  return true
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

const filteredShipments = computed(() =>
  shipments.value.filter((s) => {
    if (stateFilter.value !== 'ALL' && s.state !== stateFilter.value) {
      return false
    }
    if (carrierFilter.value !== 'ALL' && s.carrierMode !== carrierFilter.value) {
      return false
    }
    if (slaBreachedOnly.value && !s.slaBreached) {
      return false
    }
    return true
  }),
)

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

const columns: TableColumn<ShipmentDto>[] = [
  { accessorKey: 'trackingNumber', header: 'Tracking #' },
  { accessorKey: 'destination', header: 'Destination & Cargo' },
  { accessorKey: 'carrierMode', header: 'Carrier Strategy' },
  { accessorKey: 'state', header: 'State' },
  { accessorKey: 'slaBreached', header: 'SLA Window' },
  { accessorKey: 'quotedCostFormatted', header: 'Quote' },
  { id: 'actions', header: 'Lifecycle Actions' },
]

function openTimeline(shipmentId: string) {
  activeTimelineShipmentId.value = shipmentId
  timelineOpen.value = true
}

async function handleEvaluateSlas() {
  await evaluateSlas()
  await fetchShipments()
}

async function handleAction(
  shipment: ShipmentDto,
  action: 'dispatch' | 'advance' | 'deliver' | 'fail-attempt' | 'cancel',
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
  <UDashboardPanel id="deliveries-panel">
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
            @click="handleEvaluateSlas"
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
            <USelect
              v-model="stateFilter"
              :items="stateOptions"
              value-key="value"
              size="xs"
              class="w-44"
            />
            <USelect
              v-model="carrierFilter"
              :items="carrierOptions"
              value-key="value"
              size="xs"
              class="w-44"
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
            @click="fetchShipments()"
          >
            Refresh
          </UButton>
        </template>
      </UDashboardToolbar>
    </template>

    <template #body>
      <div class="space-y-4">
        <UCard :ui="{ body: 'p-0' }">
          <UTable :data="filteredShipments" :columns="columns" :loading="loading">
            <template #trackingNumber-cell="{ row }">
              <div class="space-y-0.5">
                <button
                  type="button"
                  class="font-mono text-xs font-semibold text-primary hover:underline"
                  @click="openTimeline(row.original.id)"
                >
                  {{ row.original.trackingNumber }}
                </button>
                <p class="font-mono text-[11px] text-muted">
                  From {{ row.original.originBinCode }}
                  <span v-if="row.original.carrierReference">• {{ row.original.carrierReference }}</span>
                </p>
              </div>
            </template>

            <template #destination-cell="{ row }">
              <div class="space-y-0.5">
                <p class="text-xs font-medium text-highlighted">{{ row.original.destination }}</p>
                <p class="text-[11px] text-muted">
                  {{ row.original.cargoSummary.label }} ({{ row.original.cargoSummary.handlingClass }} • {{ row.original.cargoSummary.weightKg }}kg)
                </p>
              </div>
            </template>

            <template #carrierMode-cell="{ row }">
              <UBadge color="neutral" variant="outline" size="xs">
                {{ row.original.carrierMode }}
              </UBadge>
            </template>

            <template #state-cell="{ row }">
              <div class="flex items-center gap-1.5">
                <UBadge :color="stateColors[row.original.state]" variant="subtle" size="xs">
                  {{ row.original.state }}
                </UBadge>
                <span v-if="row.original.attemptCount > 0" class="font-mono text-[10px] text-warning">
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
                <span v-else class="font-mono text-[11px] text-muted">
                  {{ row.original.remainingHours >= 0 ? `${row.original.remainingHours}h left` : `${Math.abs(row.original.remainingHours)}h overdue` }}
                </span>
              </div>
            </template>

            <template #actions-cell="{ row }">
              <div class="flex flex-wrap items-center gap-1">
                <UButton
                  v-if="row.original.state === 'PendingDispatch'"
                  size="xs"
                  color="primary"
                  variant="soft"
                  @click="handleAction(row.original, 'dispatch')"
                >
                  Dispatch
                </UButton>
                <UButton
                  v-if="row.original.state === 'Dispatched' || row.original.state === 'InTransit' || row.original.state === 'DeliveryAttemptFailed'"
                  size="xs"
                  color="info"
                  variant="soft"
                  @click="handleAction(row.original, 'advance')"
                >
                  {{ row.original.state === 'Dispatched' ? 'In Transit' : 'Out for Delivery' }}
                </UButton>
                <UButton
                  v-if="row.original.state === 'OutForDelivery' || row.original.state === 'DeliveryAttemptFailed'"
                  size="xs"
                  color="success"
                  variant="soft"
                  @click="handleAction(row.original, 'deliver')"
                >
                  Deliver
                </UButton>
                <UButton
                  v-if="row.original.state === 'OutForDelivery' || row.original.state === 'DeliveryAttemptFailed'"
                  size="xs"
                  color="warning"
                  variant="outline"
                  @click="handleAction(row.original, 'fail-attempt')"
                >
                  Fail Attempt
                </UButton>
                <UButton
                  v-if="!row.original.isTerminal"
                  size="xs"
                  color="error"
                  variant="ghost"
                  @click="handleAction(row.original, 'cancel')"
                >
                  Cancel
                </UButton>
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-history"
                  @click="openTimeline(row.original.id)"
                >
                  Timeline
                </UButton>
              </div>
            </template>
          </UTable>
        </UCard>

        <UAlert
          color="neutral"
          variant="subtle"
          icon="i-lucide-lightbulb"
          title="Try the Hexagonal Domain Guards live"
          description="Click 'Cancel' on a Dispatched/InTransit shipment to see CannotCancelDispatchedShipmentError (409), click 'Fail Attempt' 3 times to watch DeliveryExceptionChain trigger ShipmentReturnedToWarehouse -> Warehouse auto-restock, or open the Inspector to advance Virtual Clock +12h and run Evaluate SLAs."
        />
      </div>

      <DeliveryCreateShipmentModal
        v-model:open="createModalOpen"
        :available-cargo="availableCargo"
      />

      <DeliveryTimelineSlideover
        v-model:open="timelineOpen"
        :shipment-id="activeTimelineShipmentId"
      />
    </template>
  </UDashboardPanel>
</template>
