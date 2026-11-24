<script setup lang="ts">
import type { TimelineItem } from '@nuxt/ui'
import type { ShipmentTimelineDto } from '../../../shared/types/delivery'

const props = defineProps<{
  shipmentId: string | null
}>()

const open = defineModel<boolean>('open', { default: false })

const { fetchTimeline } = useDeliveries()
const timeline = ref<ShipmentTimelineDto | null>(null)
const loading = ref(false)

watch(
  () => [open.value, props.shipmentId] as const,
  async ([isOpen, id]) => {
    if (isOpen && id) {
      loading.value = true
      try {
        timeline.value = await fetchTimeline(id)
      }
      finally {
        loading.value = false
      }
    }
  },
)

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
    :description="timeline ? `${timeline.shipment.destination} • ${timeline.shipment.carrierMode}` : 'Chronological Domain Events'"
    side="right"
    :ui="{ content: 'max-w-lg' }"
  >
    <template #body>
      <div v-if="loading" class="py-8 text-center text-sm text-muted">
        Loading domain event audit trail...
      </div>

      <div v-else-if="timeline" class="space-y-5">
        <UCard :ui="{ body: 'space-y-2 p-4 text-xs' }">
          <div class="flex items-center justify-between gap-2">
            <span class="font-semibold text-highlighted">{{ timeline.shipment.cargoSummary.label }}</span>
            <UBadge
              :color="timeline.shipment.slaBreached ? 'error' : 'primary'"
              variant="subtle"
            >
              {{ timeline.shipment.state }}
            </UBadge>
          </div>
          <div class="grid grid-cols-2 gap-2 text-muted">
            <div>Origin Bin: <span class="font-mono text-highlighted">{{ timeline.shipment.originBinCode }}</span></div>
            <div>Quoted Cost: <span class="font-mono text-highlighted">{{ timeline.shipment.quotedCostFormatted }}</span></div>
            <div>Weight: <span class="font-mono text-highlighted">{{ timeline.shipment.cargoSummary.weightKg }} kg</span></div>
            <div>Attempts: <span class="font-mono text-highlighted">{{ timeline.shipment.attemptCount }} / 3</span></div>
          </div>
          <div class="pt-1 font-mono text-[11px] text-muted">
            SLA Promised By: {{ new Date(timeline.shipment.promisedByIso).toLocaleString() }}
            <UBadge v-if="timeline.shipment.slaBreached" color="error" variant="solid" size="xs" class="ml-1">
              BREACHED
            </UBadge>
          </div>
          <p v-if="timeline.shipment.lastExceptionNote" class="text-warning">
            Last Exception: {{ timeline.shipment.lastExceptionNote }}
          </p>
        </UCard>

        <div class="space-y-2">
          <h3 class="text-xs font-semibold uppercase tracking-wider text-muted">
            Domain Event Timeline ({{ timelineItems.length }})
          </h3>
          <UTimeline
            v-if="timelineItems.length > 0"
            :items="timelineItems"
            :default-value="timelineItems.length - 1"
            color="primary"
          />
          <p v-else class="text-xs text-muted">
            No domain events recorded yet for this shipment.
          </p>
        </div>
      </div>
    </template>
  </USlideover>
</template>
