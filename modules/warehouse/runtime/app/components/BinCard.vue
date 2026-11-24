<script setup lang="ts">
import type { HandlingClassDto, StorageZoneDto, WarehouseBinDto } from '../../../shared/types/warehouse'

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

const handlingColor: Record<HandlingClassDto, 'neutral' | 'warning' | 'info' | 'error'> = {
  STANDARD: 'neutral',
  FRAGILE: 'warning',
  COLD_CHAIN: 'info',
  HAZMAT: 'error',
}
</script>

<template>
  <UCard :ui="{ body: 'space-y-4 p-4' }">
    <div class="flex items-start justify-between gap-3">
      <div>
        <div class="flex items-center gap-2">
          <h3 class="font-mono text-base font-semibold text-highlighted">
            {{ bin.code }}
          </h3>
          <UBadge :color="zoneColor[bin.zone]" variant="subtle" size="xs">
            {{ bin.zone }}
          </UBadge>
          <UBadge
            v-if="bin.utilizationPercent >= 85"
            color="warning"
            variant="soft"
            size="xs"
            icon="i-lucide-alert-triangle"
          >
            Near Capacity
          </UBadge>
        </div>
        <p class="mt-0.5 text-xs text-muted">
          {{ bin.cargoCount }} unit(s) stored • Peak utilization {{ bin.utilizationPercent }}%
        </p>
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

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div class="space-y-1">
        <div class="flex items-center justify-between text-xs">
          <span class="text-muted">Weight</span>
          <span class="font-mono text-highlighted">
            {{ bin.usedWeightKg }} / {{ bin.maxWeightKg }} kg ({{ bin.weightUtilizationPercent }}%)
          </span>
        </div>
        <UProgress
          :model-value="bin.weightUtilizationPercent"
          :color="bin.weightUtilizationPercent >= 85 ? 'warning' : 'primary'"
          size="sm"
        />
      </div>

      <div class="space-y-1">
        <div class="flex items-center justify-between text-xs">
          <span class="text-muted">Volume</span>
          <span class="font-mono text-highlighted">
            {{ bin.usedVolumeM3 }} / {{ bin.maxVolumeM3 }} m³ ({{ bin.volumeUtilizationPercent }}%)
          </span>
        </div>
        <UProgress
          :model-value="bin.volumeUtilizationPercent"
          :color="bin.volumeUtilizationPercent >= 85 ? 'warning' : 'info'"
          size="sm"
        />
      </div>
    </div>

    <div v-if="bin.storedCargo.length === 0" class="rounded-md border border-dashed border-default p-3 text-center text-xs text-muted">
      Bin is currently empty.
    </div>

    <div v-else class="divide-y divide-default rounded-md border border-default">
      <div
        v-for="cargo in bin.storedCargo"
        :key="cargo.cargoId"
        class="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-xs"
      >
        <div class="space-y-0.5 min-w-0">
          <div class="flex items-center gap-1.5 flex-wrap">
            <UBadge
              :color="cargo.kind === 'PALLET' ? 'primary' : 'neutral'"
              variant="outline"
              size="xs"
              :icon="cargo.kind === 'PALLET' ? 'i-lucide-layers' : 'i-lucide-box'"
            >
              {{ cargo.kind }}
            </UBadge>
            <span class="font-medium text-highlighted">{{ cargo.label }}</span>
            <UBadge :color="handlingColor[cargo.handlingClass]" variant="subtle" size="xs">
              {{ cargo.handlingClass }}
            </UBadge>
            <UBadge
              :color="cargo.status === 'ALLOCATED' ? 'warning' : 'success'"
              variant="soft"
              size="xs"
            >
              {{ cargo.status }}
            </UBadge>
          </div>
          <p class="font-mono text-[11px] text-muted">
            {{ cargo.sku }} • {{ cargo.weightKg }} kg • {{ cargo.volumeM3 }} m³
            <span v-if="cargo.kind === 'PALLET'"> • {{ cargo.itemCount }} nested parcels</span>
          </p>
        </div>

        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-lucide-trash-2"
          :disabled="cargo.status === 'ALLOCATED'"
          @click="emit('releaseCargo', cargo.cargoId)"
        >
          Release
        </UButton>
      </div>
    </div>
  </UCard>
</template>
