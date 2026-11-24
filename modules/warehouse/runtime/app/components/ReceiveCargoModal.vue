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
const submitting = ref(false)
const cargoKind = ref<'PARCEL' | 'PALLET'>('PARCEL')

const handlingOptions: { label: string, value: HandlingClassDto }[] = [
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

watch(
  () => [props.defaultBinId, props.bins, open.value] as const,
  ([defaultId, bins]) => {
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
      Number(palletState.tareWeightKg || 0)
      + palletState.items.reduce((acc, item) => acc + Number(item.weightKg || 0), 0)
    ).toFixed(2),
  )
  const totalVolume = Number(
    palletState.items
      .reduce(
        (acc, item) =>
          acc + (Number(item.lengthCm || 0) * Number(item.widthCm || 0) * Number(item.heightCm || 0)) / 1_000_000,
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
    await receiveCargo(payload)
    open.value = false
    emit('submitted')
  }
  finally {
    submitting.value = false
  }
}

async function onSubmitPallet(event: FormSubmitEvent<ReceiveCargoRequest>) {
  submitting.value = true
  try {
    await receiveCargo(event.data)
    open.value = false
    emit('submitted')
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Receive & Store Cargo"
    description="Store a leaf Parcel or a Composite Pallet. Domain invariants enforce zone compatibility, weight, and volume limits."
    :ui="{ content: 'max-w-2xl' }"
  >
    <template #body>
      <div class="space-y-4">
        <div class="flex items-center gap-2">
          <UButton
            size="sm"
            :color="cargoKind === 'PARCEL' ? 'primary' : 'neutral'"
            :variant="cargoKind === 'PARCEL' ? 'solid' : 'outline'"
            icon="i-lucide-box"
            @click="cargoKind = 'PARCEL'"
          >
            Single Parcel (Leaf)
          </UButton>
          <UButton
            size="sm"
            :color="cargoKind === 'PALLET' ? 'primary' : 'neutral'"
            :variant="cargoKind === 'PALLET' ? 'solid' : 'outline'"
            icon="i-lucide-layers"
            @click="cargoKind = 'PALLET'"
          >
            Composite Pallet
          </UButton>
        </div>

        <!-- Single Parcel Form -->
        <UForm
          v-if="cargoKind === 'PARCEL'"
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
              <UInput v-model="parcelState.sku" class="w-full" />
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
              <UInput v-model.number="parcelState.parcel.weightKg" type="number" step="0.5" class="w-full" />
            </UFormField>
            <UFormField label="Length (cm)" name="parcel.lengthCm" required>
              <UInput v-model.number="parcelState.parcel.lengthCm" type="number" class="w-full" />
            </UFormField>
            <UFormField label="Width (cm)" name="parcel.widthCm" required>
              <UInput v-model.number="parcelState.parcel.widthCm" type="number" class="w-full" />
            </UFormField>
            <UFormField label="Height (cm)" name="parcel.heightCm" required>
              <UInput v-model.number="parcelState.parcel.heightCm" type="number" class="w-full" />
            </UFormField>
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <UButton color="neutral" variant="ghost" @click="open = false">
              Cancel
            </UButton>
            <UButton type="submit" icon="i-lucide-package-plus" :loading="submitting">
              Store Parcel
            </UButton>
          </div>
        </UForm>

        <!-- Composite Pallet Form -->
        <UForm
          v-else
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
              <UInput v-model="palletState.sku" class="w-full" />
            </UFormField>
            <UFormField label="Pallet Label" name="label" required>
              <UInput v-model="palletState.label" class="w-full" />
            </UFormField>
            <UFormField label="Tare Weight (kg)" name="tareWeightKg">
              <UInput v-model.number="palletState.tareWeightKg" type="number" class="w-full" />
            </UFormField>
          </div>

          <UAlert
            color="info"
            variant="subtle"
            icon="i-lucide-layers"
            title="Composite Pattern Live Preview"
            :description="`Computed Pallet Totals: ${palletSummary.totalWeight} kg • ${palletSummary.totalVolume} m³ • Strictest Handling Class: ${palletSummary.strictest}`"
          />

          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold uppercase tracking-wider text-muted">
                Nested Child Parcels ({{ palletState.items.length }})
              </span>
              <UButton size="xs" color="neutral" variant="outline" icon="i-lucide-plus" @click="addPalletItem">
                Add Child Parcel
              </UButton>
            </div>

            <div
              v-for="(item, idx) in palletState.items"
              :key="idx"
              class="rounded-lg border border-default p-3 space-y-2"
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
                <UInput v-model="item.sku" placeholder="SKU" size="sm" />
                <UInput v-model="item.label" placeholder="Label" size="sm" />
                <USelect
                  v-model="item.handlingClass"
                  :items="handlingOptions"
                  value-key="value"
                  size="sm"
                />
              </div>
              <div class="grid grid-cols-4 gap-2">
                <UInput v-model.number="item.weightKg" type="number" size="sm" placeholder="kg" />
                <UInput v-model.number="item.lengthCm" type="number" size="sm" placeholder="L cm" />
                <UInput v-model.number="item.widthCm" type="number" size="sm" placeholder="W cm" />
                <UInput v-model.number="item.heightCm" type="number" size="sm" placeholder="H cm" />
              </div>
            </div>
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <UButton color="neutral" variant="ghost" @click="open = false">
              Cancel
            </UButton>
            <UButton type="submit" icon="i-lucide-layers" :loading="submitting">
              Store Composite Pallet
            </UButton>
          </div>
        </UForm>
      </div>
    </template>
  </UModal>
</template>
