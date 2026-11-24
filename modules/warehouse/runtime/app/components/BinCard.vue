<script setup lang="ts">
import type {
  HandlingClassDto,
  StorageZoneDto,
  WarehouseBinDto,
} from '../../../shared/types/warehouse'

defineProps<{
  bin: WarehouseBinDto
}>()

const emit = defineEmits<{
  receiveIntoBin: [binId: string]
  releaseCargo: [cargoId: string]
}>()

const zoneColor: Record<StorageZoneDto, 'neutral' | 'info' | 'error'> = {
  AMBIENT: 'neutral',
  COLD_CHAIN: 'info',
  HAZMAT: 'error',
}

const zoneIcon: Record<StorageZoneDto, string> = {
  AMBIENT: 'i-lucide-thermometer',
  COLD_CHAIN: 'i-lucide-snowflake',
  HAZMAT: 'i-lucide-flame',
}

const labelize = (v: string) => v.charAt(0) + v.slice(1).toLowerCase().replaceAll('_', ' ')

const handlingColor: Record<HandlingClassDto, 'neutral' | 'warning' | 'info' | 'error'> = {
  STANDARD: 'neutral',
  FRAGILE: 'warning',
  COLD_CHAIN: 'info',
  HAZMAT: 'error',
}
</script>

<template>
  <UCard :ui="{ body: 'space-y-4 p-4 sm:p-5' }">
    <div class="flex items-start justify-between gap-3">
      <div class="flex items-start gap-2.5 min-w-0">
        <div class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-default bg-elevated/60">
          <UIcon :name="zoneIcon[bin.zone]" class="size-4 text-highlighted" />
        </div>
        <div class="min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <h3 class="font-mono text-sm font-semibold text-highlighted">
              {{ bin.code }}
            </h3>
            <UBadge :color="zoneColor[bin.zone]" variant="subtle" size="sm">
              {{ labelize(bin.zone) }}
            </UBadge>
            <UBadge
              v-if="bin.utilizationPercent >= 85"
              color="warning"
              variant="soft"
              size="sm"
              icon="i-lucide-alert-triangle"
            >
              Near Capacity
            </UBadge>
          </div>
          <p class="mt-0.5 text-xs text-muted tabular-nums">
            {{ bin.cargoCount }} unit(s) stored • Peak utilization {{ bin.utilizationPercent }}%
          </p>
        </div>
      </div>

      <UButton
        size="xs"
        color="primary"
        variant="soft"
        icon="i-lucide-plus"
        @click="emit('receiveIntoBin', bin.id)"
      >
        Store Cargo
      </UButton>
    </div>

    <div class="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      <div class="space-y-1.5">
        <div class="flex items-center justify-between text-xs">
          <span class="text-muted">Weight</span>
          <span class="font-mono text-highlighted tabular-nums">
            {{ bin.usedWeightKg }} / {{ bin.maxWeightKg }} kg ({{ bin.weightUtilizationPercent }}%)
          </span>
        </div>
        <UProgress
          :model-value="bin.weightUtilizationPercent"
          :color="bin.weightUtilizationPercent >= 85 ? 'warning' : 'primary'"
          size="xs"
          :ui="{ indicator: bin.weightUtilizationPercent === 0 ? 'opacity-0' : '' }"
        />
      </div>

      <div class="space-y-1.5">
        <div class="flex items-center justify-between text-xs">
          <span class="text-muted">Volume</span>
          <span class="font-mono text-highlighted tabular-nums">
            {{ bin.usedVolumeM3 }} / {{ bin.maxVolumeM3 }} m³ ({{ bin.volumeUtilizationPercent }}%)
          </span>
        </div>
        <UProgress
          :model-value="bin.volumeUtilizationPercent"
          :color="bin.volumeUtilizationPercent >= 85 ? 'warning' : 'info'"
          size="xs"
          :ui="{ indicator: bin.volumeUtilizationPercent === 0 ? 'opacity-0' : '' }"
        />
      </div>
    </div>

    <UEmpty
      v-if="bin.storedCargo.length === 0"
      variant="naked"
      size="sm"
      icon="i-lucide-inbox"
      title="Bay is empty and ready for intake"
      description="Store a parcel or composite pallet into this bay."
      :actions="[{ label: `Store into ${bin.code}`, size: 'xs', color: 'neutral', variant: 'outline', onClick: () => emit('receiveIntoBin', bin.id) }]"
    />

    <div v-else class="divide-y divide-default rounded-md border border-default">
      <div
        v-for="cargo in bin.storedCargo"
        :key="cargo.cargoId"
        class="flex items-center justify-between gap-3 px-3 py-3"
      >
        <div class="flex min-w-0 items-start gap-3">
          <div
            class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md"
            :class="cargo.kind === 'PALLET' ? 'bg-primary/10 text-primary' : 'bg-elevated text-muted'"
          >
            <UIcon :name="cargo.kind === 'PALLET' ? 'i-lucide-layers' : 'i-lucide-box'" class="size-4" />
          </div>
          <div class="min-w-0 space-y-1">
            <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span class="text-sm font-medium text-highlighted">{{ cargo.label }}</span>
              <UBadge
                v-if="cargo.handlingClass !== 'STANDARD'"
                :color="handlingColor[cargo.handlingClass]"
                variant="subtle"
                size="sm"
              >
                {{ labelize(cargo.handlingClass) }}
              </UBadge>
              <UBadge
                v-if="cargo.status === 'ALLOCATED'"
                color="warning"
                variant="soft"
                size="sm"
                icon="i-lucide-lock"
              >
                Allocated
              </UBadge>
            </div>
            <p class="font-mono text-xs text-muted tabular-nums">
              {{ cargo.sku }} · {{ cargo.weightKg }} kg · {{ cargo.volumeM3 }} m³
              <span v-if="cargo.kind === 'PALLET'">· {{ cargo.itemCount }} nested parcels</span>
            </p>
          </div>
        </div>

        <UTooltip
          :text="cargo.status === 'ALLOCATED' ? 'Allocated to shipment — cancel shipment to release' : 'Release from bin'"
        >
          <UButton
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-trash-2"
            :aria-label="`Release ${cargo.label}`"
            :disabled="cargo.status === 'ALLOCATED'"
            @click="emit('releaseCargo', cargo.cargoId)"
          />
        </UTooltip>
      </div>
    </div>
  </UCard>
</template>
