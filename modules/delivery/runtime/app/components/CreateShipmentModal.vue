<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { createShipmentRequestSchema } from '../../../shared/schemas/delivery.schema'
import type { CreateShipmentRequest } from '../../../shared/schemas/delivery.schema'
import type { AvailableCargoDto, CarrierModeDto, DeliveryQuoteDto } from '../../../shared/types/delivery'

const props = defineProps<{
  availableCargo: readonly AvailableCargoDto[]
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  created: []
}>()

const { createShipment } = useDeliveries()

const submitting = shallowRef(false)
const submitError = shallowRef<string | null>(null)

const carrierOptions: { label: string, value: CarrierModeDto, description: string }[] = [
  {
    label: 'Standard Ground Freight',
    value: 'STANDARD_GROUND',
    description: '36–48h SLA • Standard & Fragile cargo',
  },
  {
    label: 'Express Air Priority',
    value: 'EXPRESS_AIR',
    description: '12h SLA • Priority air linehaul',
  },
  {
    label: 'Cold-Chain Thermal Courier',
    value: 'COLD_CHAIN_COURIER',
    description: '18h SLA • Temperature-controlled (-20°C)',
  },
]

const state = reactive<CreateShipmentRequest>({
  cargoId: '',
  destination: 'Amsterdam Port Logistics Hub, NL',
  carrierMode: 'STANDARD_GROUND',
})

const cargoOptions = computed(() =>
  props.availableCargo.map(item => ({
    label: `${item.label} [${item.binCode} • ${item.handlingClass} • ${item.weightKg}kg]`,
    value: item.cargoId,
  })),
)

const selectedCargo = computed(() =>
  props.availableCargo.find(item => item.cargoId === state.cargoId) ?? null,
)

watch(
  () => [open.value, props.availableCargo] as const,
  ([isOpen, cargo]) => {
    if (isOpen) {
      submitError.value = null
    }
    if (isOpen && cargo.length > 0 && !cargo.some(c => c.cargoId === state.cargoId)) {
      state.cargoId = cargo[0]!.cargoId
    }
  },
  { immediate: true },
)

const quoteBody = computed(() => {
  if (!selectedCargo.value) {
    return undefined
  }
  return {
    carrierMode: state.carrierMode,
    weightKg: selectedCargo.value.weightKg,
    volumeM3: selectedCargo.value.volumeM3,
    handlingClass: selectedCargo.value.handlingClass,
  }
})

const { data: quote, error: quoteFetchError, status: quoteStatus } = useAPI<DeliveryQuoteDto>('/api/deliveries/quote', {
  key: () => `delivery:quote:${state.cargoId}:${state.carrierMode}`,
  method: 'POST',
  body: quoteBody,
  enabled: () => open.value && Boolean(quoteBody.value),
  dedupe: 'cancel',
  server: false,
  getCachedData: () => undefined,
})

const quoteError = computed(() =>
  quoteFetchError.value
    ? formatApiError(quoteFetchError.value, 'Strategy cannot quote this cargo').details
    : null,
)

async function onSubmit(event: FormSubmitEvent<CreateShipmentRequest>) {
  submitting.value = true
  submitError.value = null
  try {
    await createShipment(event.data, { silentErrorToast: true })
    open.value = false
    emit('created')
  }
  catch (err: unknown) {
    submitError.value = formatApiError(err, 'Failed to create shipment').details
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Create Shipment from Warehouse Stock"
    description="Select available cargo via the WarehouseStockPort ACL and pick a CarrierStrategy for live pricing & SLA calculation."
    :ui="{ content: 'max-w-xl', footer: 'justify-end' }"
  >
    <template #body>
      <UEmpty
        v-if="availableCargo.length === 0"
        variant="naked"
        icon="i-lucide-package-open"
        title="No available warehouse cargo units"
        description="Receive a parcel or pallet in the Warehouse Storage view first."
      />

      <UForm
        v-else
        id="create-shipment-form"
        :schema="createShipmentRequestSchema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UAlert
          v-if="submitError"
          color="error"
          variant="subtle"
          icon="i-lucide-shield-alert"
          title="Shipment Creation Rejected"
          :description="submitError"
        />

        <UFormField label="Available Warehouse Cargo (via ACL)" name="cargoId" required>
          <USelect
            v-model="state.cargoId"
            :items="cargoOptions"
            value-key="value"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Carrier Strategy" name="carrierMode" required>
          <URadioGroup
            v-model="state.carrierMode"
            :items="carrierOptions"
            value-key="value"
            variant="card"
            size="sm"
          />
        </UFormField>

        <UFormField label="Destination Address" name="destination" required>
          <UInput v-model="state.destination" placeholder="e.g. Rotterdam Europort Terminal, NL" class="w-full" />
        </UFormField>

        <!-- Live Quote Preview -->
        <UAlert
          v-if="quoteError"
          color="error"
          variant="subtle"
          icon="i-lucide-shield-alert"
          title="CarrierStrategy Rejected Handling Class"
          :description="quoteError"
        />

        <div
          v-else-if="quote"
          class="rounded-md border border-default bg-elevated/40 p-3.5 space-y-1.5"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-semibold text-highlighted">{{ quote.carrierLabel }}</span>
            <UBadge color="primary" variant="solid" size="sm" class="font-mono tabular-nums">
              {{ quote.costFormatted }}
            </UBadge>
          </div>
          <p class="text-xs text-muted">{{ quote.notes }}</p>
          <p class="font-mono text-[11px] text-muted tabular-nums">
            SLA Window: {{ quote.estimatedHours }}h • Promised by
            <NuxtTime :datetime="quote.promisedByIso" date-style="short" time-style="short" />
          </p>
        </div>

        <div v-else-if="quoteStatus === 'pending'" class="space-y-2 rounded-md border border-default p-3.5">
          <USkeleton class="h-4 w-48" />
          <USkeleton class="h-3 w-full" />
        </div>
      </UForm>
    </template>

    <template #footer="{ close }">
      <UButton color="neutral" variant="outline" @click="close">
        Cancel
      </UButton>
      <UButton
        v-if="availableCargo.length > 0"
        type="submit"
        form="create-shipment-form"
        icon="i-lucide-send"
        :loading="submitting"
      >
        Allocate & Create Shipment
      </UButton>
    </template>
  </UModal>
</template>
