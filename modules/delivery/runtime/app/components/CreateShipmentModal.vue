<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { createShipmentRequestSchema } from '../../../shared/schemas/delivery.schema'
import type { CreateShipmentRequest } from '../../../shared/schemas/delivery.schema'
import type { AvailableCargoDto, CarrierModeDto, DeliveryQuoteDto } from '../../../shared/types/delivery'

const props = defineProps<{
  availableCargo: AvailableCargoDto[]
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  created: []
}>()

const { quoteShipment, createShipment } = useDeliveries()

const submitting = ref(false)
const quote = ref<DeliveryQuoteDto | null>(null)
const quoteError = ref<string | null>(null)

const carrierOptions: { label: string, value: CarrierModeDto }[] = [
  { label: 'Standard Ground Freight (36–48h)', value: 'STANDARD_GROUND' },
  { label: 'Express Air Priority (12h)', value: 'EXPRESS_AIR' },
  { label: 'Cold-Chain Thermal Courier (18h)', value: 'COLD_CHAIN_COURIER' },
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
    if (isOpen && cargo.length > 0 && !cargo.some(c => c.cargoId === state.cargoId)) {
      state.cargoId = cargo[0]!.cargoId
    }
  },
  { immediate: true },
)

watch(
  () => [state.cargoId, state.carrierMode, open.value] as const,
  async ([, , isOpen]) => {
    if (!isOpen || !selectedCargo.value) {
      quote.value = null
      quoteError.value = null
      return
    }
    try {
      quoteError.value = null
      quote.value = await quoteShipment({
        carrierMode: state.carrierMode,
        weightKg: selectedCargo.value.weightKg,
        volumeM3: selectedCargo.value.volumeM3,
        handlingClass: selectedCargo.value.handlingClass,
      })
    }
    catch (err: unknown) {
      quote.value = null
      const e = err as { data?: { statusMessage?: string }, message?: string }
      quoteError.value = e?.data?.statusMessage ?? e?.message ?? 'Strategy cannot quote this cargo'
    }
  },
  { immediate: true },
)

async function onSubmit(event: FormSubmitEvent<CreateShipmentRequest>) {
  submitting.value = true
  try {
    await createShipment(event.data)
    open.value = false
    emit('created')
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
    :ui="{ content: 'max-w-xl' }"
  >
    <template #body>
      <div v-if="availableCargo.length === 0" class="py-6 text-center space-y-2">
        <UIcon name="i-lucide-package-open" class="mx-auto size-8 text-muted" />
        <p class="text-sm font-medium text-highlighted">No available warehouse cargo units</p>
        <p class="text-xs text-muted">
          Receive a parcel or pallet in the Warehouse Storage view first.
        </p>
      </div>

      <UForm
        v-else
        :schema="createShipmentRequestSchema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField label="Available Warehouse Cargo (via ACL)" name="cargoId" required>
          <USelect
            v-model="state.cargoId"
            :items="cargoOptions"
            value-key="value"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Carrier Strategy" name="carrierMode" required>
          <USelect
            v-model="state.carrierMode"
            :items="carrierOptions"
            value-key="value"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Destination Address" name="destination" required>
          <UInput v-model="state.destination" placeholder="e.g. Rotterdam Europort Terminal, NL" class="w-full" />
        </UFormField>

        <!-- Live Quote Preview -->
        <UCard v-if="quote" :ui="{ body: 'space-y-1.5 p-3.5 bg-elevated/50' }">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-highlighted">{{ quote.carrierLabel }}</span>
            <UBadge color="primary" variant="solid" size="sm">
              {{ quote.costFormatted }}
            </UBadge>
          </div>
          <p class="text-xs text-muted">{{ quote.notes }}</p>
          <p class="font-mono text-[11px] text-muted">
            SLA Window: {{ quote.estimatedHours }}h • Promised by {{ new Date(quote.promisedByIso).toLocaleString() }}
          </p>
        </UCard>

        <UAlert
          v-else-if="quoteError"
          color="error"
          variant="subtle"
          icon="i-lucide-shield-alert"
          title="CarrierStrategy Rejected Handling Class"
          :description="quoteError"
        />

        <div class="flex justify-end gap-2 pt-2">
          <UButton color="neutral" variant="ghost" @click="open = false">
            Cancel
          </UButton>
          <UButton
            type="submit"
            icon="i-lucide-send"
            :loading="submitting"
          >
            Allocate & Create Shipment
          </UButton>
        </div>
      </UForm>
    </template>
  </UModal>
</template>
