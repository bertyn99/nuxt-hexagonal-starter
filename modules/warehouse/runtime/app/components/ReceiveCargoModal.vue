<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import {
  receivePalletRequestSchema,
  receiveParcelRequestSchema,
} from '../../../shared/schemas/warehouse.schema'
import type { ParcelItemForm, ReceiveCargoRequest } from '../../../shared/schemas/warehouse.schema'
import type { HandlingClassDto, WarehouseBinDto } from '../../../shared/types/warehouse'

const props = defineProps<{
  bins: WarehouseBinDto[]
  defaultBinId?: string
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  submitted: []
}>()

const { receiveCargo } = useWarehouse()
const submitting = shallowRef(false)
const submitError = shallowRef<string | null>(null)
const cargoKind = shallowRef<'PARCEL' | 'PALLET'>('PARCEL')

const kindTabs = [
  { label: 'Single Parcel (Leaf)', value: 'PARCEL', icon: 'i-lucide-box' },
  { label: 'Composite Pallet', value: 'PALLET', icon: 'i-lucide-layers' },
]

const handlingOptions: { label: string; value: HandlingClassDto }[] = [
  { label: 'Standard', value: 'STANDARD' },
  { label: 'Fragile', value: 'FRAGILE' },
  { label: 'Cold Chain (-20°C)', value: 'COLD_CHAIN' },
  { label: 'Hazmat (Class 9)', value: 'HAZMAT' },
]

const binOptions = computed(() =>
  props.bins.map(bin => ({
    label: `${bin.code} (${bin.zone} • ${bin.utilizationPercent}% full)`,
    value: bin.id,
  })),
)

const parcelState = reactive({
  binId: props.defaultBinId || '',
  kind: 'PARCEL' as const,
  sku: 'SKU-NEW-101',
  label: 'Precision Optical Sensor',
  parcel: {
    sku: 'SKU-NEW-101',
    label: 'Precision Optical Sensor',
    weightKg: 14.5,
    lengthCm: 50,
    widthCm: 40,
    heightCm: 30,
    handlingClass: 'FRAGILE' as HandlingClassDto,
  },
})

const palletState = reactive({
  binId: props.defaultBinId || '',
  kind: 'PALLET' as const,
  sku: 'PLT-MIX-202',
  label: 'Mixed Medical Supply Pallet',
  tareWeightKg: 15,
  items: [
    {
      sku: 'SKU-MED-01',
      label: 'Sterile Packaging Cartons',
      weightKg: 28,
      lengthCm: 80,
      widthCm: 60,
      heightCm: 40,
      handlingClass: 'STANDARD' as HandlingClassDto,
    },
    {
      sku: 'SKU-MED-02',
      label: 'Cold-Chain Vaccine Pack',
      weightKg: 16,
      lengthCm: 55,
      widthCm: 45,
      heightCm: 35,
      handlingClass: 'COLD_CHAIN' as HandlingClassDto,
    },
  ] as ParcelItemForm[],
})

watch(cargoKind, () => {
  submitError.value = null
})

watch(
  () => [props.defaultBinId, props.bins, open.value] as const,
  ([defaultId, bins, isOpen]) => {
    if (isOpen) {
      submitError.value = null
    }
    const fallback = defaultId || bins[0]?.id || ''
    if (fallback) {
      parcelState.binId = fallback
      palletState.binId = fallback
    }
  },
  { immediate: true },
)

const SEVERITY: Record<HandlingClassDto, number> = {
  STANDARD: 0,
  FRAGILE: 1,
  COLD_CHAIN: 2,
  HAZMAT: 3,
}

const palletSummary = computed(() => {
  const totalWeight = Number(
    (
      Number(palletState.tareWeightKg || 0) +
      palletState.items.reduce((acc, item) => acc + Number(item.weightKg || 0), 0)
    ).toFixed(2),
  )
  const totalVolume = Number(
    palletState.items
      .reduce(
        (acc, item) =>
          acc +
          (Number(item.lengthCm || 0) * Number(item.widthCm || 0) * Number(item.heightCm || 0)) /
            1_000_000,
        0,
      )
      .toFixed(4),
  )
  const strictest = palletState.items.reduce<HandlingClassDto>((best, item) => {
    return SEVERITY[item.handlingClass] > SEVERITY[best] ? item.handlingClass : best
  }, 'STANDARD')
  return { totalWeight, totalVolume, strictest }
})

function addPalletItem() {
  palletState.items.push({
    sku: `SKU-SUB-${palletState.items.length + 1}`,
    label: `Pallet Carton #${palletState.items.length + 1}`,
    weightKg: 10,
    lengthCm: 45,
    widthCm: 35,
    heightCm: 30,
    handlingClass: 'STANDARD',
  })
}

function removePalletItem(index: number) {
  if (palletState.items.length > 1) {
    palletState.items.splice(index, 1)
  }
}

async function onSubmitParcel(event: FormSubmitEvent<ReceiveCargoRequest>) {
  submitting.value = true
  submitError.value = null
  try {
    const payload = {
      ...event.data,
      kind: 'PARCEL' as const,
      parcel: {
        ...(event.data as Extract<ReceiveCargoRequest, { kind: 'PARCEL' }>).parcel,
        sku: event.data.sku,
        label: event.data.label,
      },
    }
    await receiveCargo(payload, { silentErrorToast: true })
    open.value = false
    emit('submitted')
  } catch (err: unknown) {
    submitError.value = formatApiError(err, 'Failed to store parcel').details
  } finally {
    submitting.value = false
  }
}

async function onSubmitPallet(event: FormSubmitEvent<ReceiveCargoRequest>) {
  submitting.value = true
  submitError.value = null
  try {
    await receiveCargo(event.data, { silentErrorToast: true })
    open.value = false
    emit('submitted')
  } catch (err: unknown) {
    submitError.value = formatApiError(err, 'Failed to store pallet').details
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Receive & Store Cargo"
    description="Store a leaf Parcel or a Composite Pallet. Domain invariants enforce zone compatibility, weight, and volume limits."
    :ui="{ content: 'max-w-2xl', footer: 'justify-end' }"
  >
    <template #body>
      <div class="space-y-4">
        <UTabs v-model="cargoKind" :items="kindTabs" :content="false" size="sm" class="w-full" />

        <UAlert
          v-if="submitError"
          color="error"
          variant="subtle"
          icon="i-lucide-shield-alert"
          title="Domain Rule Rejected Storage"
          :description="submitError"
        />

        <!-- Single Parcel Form -->
        <UForm
          v-if="cargoKind === 'PARCEL'"
          id="receive-parcel-form"
          :schema="receiveParcelRequestSchema"
          :state="parcelState"
          class="space-y-4"
          @submit="onSubmitParcel"
        >
          <UFormField label="Target Warehouse Bin" name="binId" required>
            <USelect
              v-model="parcelState.binId"
              :items="binOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <UFormField label="SKU" name="sku" required>
              <UInput v-model="parcelState.sku" class="w-full font-mono" />
            </UFormField>
            <UFormField label="Handling Class" name="parcel.handlingClass" required>
              <USelect
                v-model="parcelState.parcel.handlingClass"
                :items="handlingOptions"
                value-key="value"
                class="w-full"
              />
            </UFormField>
          </div>

          <UFormField label="Cargo Label" name="label" required>
            <UInput v-model="parcelState.label" class="w-full" />
          </UFormField>

          <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <UFormField label="Weight (kg)" name="parcel.weightKg" required>
              <UInput
                v-model.number="parcelState.parcel.weightKg"
                type="number"
                step="0.5"
                class="w-full font-mono"
              />
            </UFormField>
            <UFormField label="Length (cm)" name="parcel.lengthCm" required>
              <UInput
                v-model.number="parcelState.parcel.lengthCm"
                type="number"
                class="w-full font-mono"
              />
            </UFormField>
            <UFormField label="Width (cm)" name="parcel.widthCm" required>
              <UInput
                v-model.number="parcelState.parcel.widthCm"
                type="number"
                class="w-full font-mono"
              />
            </UFormField>
            <UFormField label="Height (cm)" name="parcel.heightCm" required>
              <UInput
                v-model.number="parcelState.parcel.heightCm"
                type="number"
                class="w-full font-mono"
              />
            </UFormField>
          </div>
        </UForm>

        <!-- Composite Pallet Form -->
        <UForm
          v-else
          id="receive-pallet-form"
          :schema="receivePalletRequestSchema"
          :state="palletState"
          class="space-y-4"
          @submit="onSubmitPallet"
        >
          <UFormField label="Target Warehouse Bin" name="binId" required>
            <USelect
              v-model="palletState.binId"
              :items="binOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <UFormField label="Pallet SKU" name="sku" required>
              <UInput v-model="palletState.sku" class="w-full font-mono" />
            </UFormField>
            <UFormField label="Pallet Label" name="label" required>
              <UInput v-model="palletState.label" class="w-full" />
            </UFormField>
            <UFormField label="Tare Weight (kg)" name="tareWeightKg">
              <UInput
                v-model.number="palletState.tareWeightKg"
                type="number"
                class="w-full font-mono"
              />
            </UFormField>
          </div>

          <div
            class="grid grid-cols-3 divide-x divide-default rounded-md border border-default bg-elevated/40 p-3 text-xs"
          >
            <div class="pr-3">
              <span class="text-muted">Composite Weight</span>
              <p class="mt-0.5 font-mono font-semibold text-highlighted tabular-nums">
                {{ palletSummary.totalWeight }} kg
              </p>
            </div>
            <div class="px-3">
              <span class="text-muted">Total Volume</span>
              <p class="mt-0.5 font-mono font-semibold text-highlighted tabular-nums">
                {{ palletSummary.totalVolume }} m³
              </p>
            </div>
            <div class="pl-3">
              <span class="text-muted">Strictest Handling</span>
              <p class="mt-0.5 font-mono font-semibold text-primary">
                {{ palletSummary.strictest }}
              </p>
            </div>
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-muted">
                Nested Child Parcels ({{ palletState.items.length }})
              </span>
              <UButton
                size="xs"
                color="neutral"
                variant="outline"
                icon="i-lucide-plus"
                @click="addPalletItem"
              >
                Add Child Parcel
              </UButton>
            </div>

            <div
              v-for="(item, idx) in palletState.items"
              :key="idx"
              class="rounded-md border border-default p-3 space-y-2 bg-elevated/20"
            >
              <div class="flex items-center justify-between">
                <span class="text-xs font-medium text-highlighted">Parcel #{{ idx + 1 }}</span>
                <UButton
                  v-if="palletState.items.length > 1"
                  size="xs"
                  color="error"
                  variant="ghost"
                  icon="i-lucide-x"
                  @click="removePalletItem(idx)"
                />
              </div>
              <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <UInput v-model="item.sku" placeholder="SKU" size="sm" class="font-mono" />
                <UInput v-model="item.label" placeholder="Label" size="sm" />
                <USelect
                  v-model="item.handlingClass"
                  :items="handlingOptions"
                  value-key="value"
                  size="sm"
                />
              </div>
              <div class="grid grid-cols-4 gap-2">
                <UFormField label="Weight (kg)" size="xs">
                  <UInput
                    v-model.number="item.weightKg"
                    type="number"
                    size="sm"
                    class="font-mono w-full"
                  />
                </UFormField>
                <UFormField label="L (cm)" size="xs">
                  <UInput
                    v-model.number="item.lengthCm"
                    type="number"
                    size="sm"
                    class="font-mono w-full"
                  />
                </UFormField>
                <UFormField label="W (cm)" size="xs">
                  <UInput
                    v-model.number="item.widthCm"
                    type="number"
                    size="sm"
                    class="font-mono w-full"
                  />
                </UFormField>
                <UFormField label="H (cm)" size="xs">
                  <UInput
                    v-model.number="item.heightCm"
                    type="number"
                    size="sm"
                    class="font-mono w-full"
                  />
                </UFormField>
              </div>
            </div>
          </div>
        </UForm>
      </div>
    </template>

    <template #footer="{ close }">
      <UButton color="neutral" variant="outline" @click="close"> Cancel </UButton>
      <UButton
        type="submit"
        :form="cargoKind === 'PARCEL' ? 'receive-parcel-form' : 'receive-pallet-form'"
        :icon="cargoKind === 'PARCEL' ? 'i-lucide-package-plus' : 'i-lucide-layers'"
        :loading="submitting"
      >
        {{ cargoKind === 'PARCEL' ? 'Store Parcel' : 'Store Composite Pallet' }}
      </UButton>
    </template>
  </UModal>
</template>
