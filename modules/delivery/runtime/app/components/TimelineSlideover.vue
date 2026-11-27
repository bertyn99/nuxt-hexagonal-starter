<script setup lang="ts">
import type { TimelineItem } from '@nuxt/ui'
import type { ShipmentTimelineDto } from '../../../shared/types/delivery'

const props = defineProps<{
  shipmentId: string | null
}>()

const open = defineModel<boolean>('open', { default: false })

const {
  data: timeline,
  status,
  error: fetchError,
  refresh,
} = useAPI<ShipmentTimelineDto>(
  () => `/api/deliveries/${encodeURIComponent(props.shipmentId ?? '')}/timeline`,
  {
    key: () => `delivery:timeline:${props.shipmentId ?? 'none'}`,
    enabled: () => open.value && Boolean(props.shipmentId),
    dedupe: 'cancel',
    server: false,
    getCachedData: () => undefined,
  },
)

const loading = computed(() => status.value === 'pending')
const loadError = computed(() =>
  fetchError.value
    ? formatApiError(fetchError.value, 'Failed to load shipment timeline').details
    : null,
)

const stateColors: Record<
  string,
  'neutral' | 'info' | 'primary' | 'warning' | 'success' | 'error'
> = {
  PendingDispatch: 'neutral',
  Dispatched: 'info',
  InTransit: 'primary',
  OutForDelivery: 'primary',
  DeliveryAttemptFailed: 'warning',
  Delivered: 'success',
  ReturnedToWarehouse: 'error',
  Cancelled: 'neutral',
}

const eventIcons: Record<string, string> = {
  ShipmentCreated: 'i-lucide-file-plus-2',
  ShipmentDispatched: 'i-lucide-truck',
  ShipmentTransitAdvanced: 'i-lucide-navigation',
  DeliveryAttemptFailed: 'i-lucide-alert-octagon',
  DeliverySlaBreached: 'i-lucide-alarm-clock-off',
  ShipmentReturnedToWarehouse: 'i-lucide-undo-2',
  ShipmentDelivered: 'i-lucide-check-circle-2',
  ShipmentCancelled: 'i-lucide-ban',
}

const timelineItems = computed<TimelineItem[]>(() => {
  if (!timeline.value) {
    return []
  }
  return timeline.value.events.map(ev => ({
    date: new Date(ev.occurredAt).toLocaleString(),
    title: ev.eventName,
    description: ev.summary,
    icon: eventIcons[ev.eventName] ?? 'i-lucide-circle-dot',
  }))
})
</script>

<template>
  <USlideover
    v-model:open="open"
    :title="timeline ? `Tracking ${timeline.shipment.trackingNumber}` : 'Shipment Audit Trail'"
    :description="
      timeline
        ? `${timeline.shipment.destination} • ${timeline.shipment.carrierMode}`
        : 'Chronological Domain Events'
    "
    side="right"
    :ui="{ content: 'max-w-lg' }"
  >
    <template #body>
      <div v-if="loading" class="space-y-4">
        <USkeleton class="h-28 w-full" />
        <USkeleton class="h-16 w-full" />
        <USkeleton class="h-16 w-full" />
      </div>

      <UAlert
        v-else-if="loadError"
        color="error"
        variant="subtle"
        icon="i-lucide-alert-circle"
        title="Unable to load shipment timeline"
        :description="loadError"
        :actions="[
          { label: 'Retry', color: 'error', variant: 'outline', onClick: () => refresh() },
        ]"
      />

      <div v-else-if="timeline" class="space-y-5">
        <div class="rounded-lg border border-default bg-elevated/35 p-4 space-y-3 text-xs">
          <div class="flex items-center justify-between gap-2">
            <span class="font-semibold text-highlighted">{{
              timeline.shipment.cargoSummary.label
            }}</span>
            <UBadge
              :color="
                timeline.shipment.slaBreached
                  ? 'error'
                  : (stateColors[timeline.shipment.state] ?? 'neutral')
              "
              variant="subtle"
            >
              {{ timeline.shipment.state }}
            </UBadge>
          </div>
          <div class="grid grid-cols-2 gap-2 text-muted tabular-nums">
            <div>
              Origin Bin:
              <span class="font-mono text-highlighted">{{ timeline.shipment.originBinCode }}</span>
            </div>
            <div>
              Quoted Cost:
              <span class="font-mono text-highlighted">{{
                timeline.shipment.quotedCostFormatted
              }}</span>
            </div>
            <div>
              Weight:
              <span class="font-mono text-highlighted"
                >{{ timeline.shipment.cargoSummary.weightKg }} kg</span
              >
            </div>
            <div>
              Attempts:
              <span class="font-mono text-highlighted"
                >{{ timeline.shipment.attemptCount }} / 3</span
              >
            </div>
          </div>
          <div
            class="pt-1 border-t border-default/60 font-mono text-[11px] text-muted flex items-center justify-between gap-2"
          >
            <span>
              Promised By:
              <NuxtTime
                :datetime="timeline.shipment.promisedByIso"
                date-style="short"
                time-style="short"
              />
            </span>
            <UBadge v-if="timeline.shipment.slaBreached" color="error" variant="solid" size="xs">
              BREACHED
            </UBadge>
          </div>
          <UAlert
            v-if="timeline.shipment.lastExceptionNote"
            color="warning"
            variant="subtle"
            icon="i-lucide-alert-octagon"
            title="Last Delivery Exception"
            :description="timeline.shipment.lastExceptionNote"
          />
        </div>

        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-xs font-semibold text-highlighted">Domain Event Timeline</h3>
            <UBadge color="neutral" variant="subtle" size="xs" class="tabular-nums">
              {{ timelineItems.length }} event(s)
            </UBadge>
          </div>

          <UTimeline
            v-if="timelineItems.length > 0"
            :items="timelineItems"
            :default-value="timelineItems.length - 1"
            color="primary"
          />
          <UEmpty
            v-else
            variant="naked"
            size="sm"
            icon="i-lucide-history"
            title="No domain events recorded yet"
            description="Lifecycle events will appear here as this shipment progresses."
          />
        </div>
      </div>
    </template>
  </USlideover>
</template>
