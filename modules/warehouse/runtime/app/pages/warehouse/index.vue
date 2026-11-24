<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { StorageZoneDto, StoredCargoDto } from '../../../../shared/types/warehouse'

definePageMeta({
  title: 'Warehouse Storage (WMS)',
})

const { bins, utilization, loading, fetchAll, releaseCargo } = useWarehouse()
const { open: openInspector } = useHexInspector()

const selectedZone = ref<StorageZoneDto | 'ALL'>('ALL')
const receiveModalOpen = ref(false)
const selectedBinIdForModal = ref<string | undefined>(undefined)

await useAsyncData('warehouse-page-init', async () => {
  await fetchAll()
  return true
})

const zones: { label: string, value: StorageZoneDto | 'ALL' }[] = [
  { label: 'All Zones', value: 'ALL' },
  { label: 'Ambient', value: 'AMBIENT' },
  { label: 'Cold Chain', value: 'COLD_CHAIN' },
  { label: 'Hazmat', value: 'HAZMAT' },
]

const filteredBins = computed(() => {
  if (selectedZone.value === 'ALL') {
    return bins.value
  }
  return bins.value.filter(bin => bin.zone === selectedZone.value)
})

interface FlattenedCargoRow extends StoredCargoDto {
  binCode: string
  zone: StorageZoneDto
}

const allCargoRows = computed<FlattenedCargoRow[]>(() =>
  filteredBins.value.flatMap(bin =>
    bin.storedCargo.map(cargo => ({
      ...cargo,
      binCode: bin.code,
      zone: bin.zone,
    })),
  ),
)

const cargoColumns: TableColumn<FlattenedCargoRow>[] = [
  { accessorKey: 'binCode', header: 'Bin' },
  { accessorKey: 'kind', header: 'Type' },
  { accessorKey: 'label', header: 'Cargo Unit' },
  { accessorKey: 'handlingClass', header: 'Handling' },
  { accessorKey: 'weightKg', header: 'Weight (kg)' },
  { accessorKey: 'volumeM3', header: 'Volume (m³)' },
  { accessorKey: 'status', header: 'Stock Status' },
]

function openReceiveModal(binId?: string) {
  selectedBinIdForModal.value = binId
  receiveModalOpen.value = true
}
</script>

<template>
  <UDashboardPanel id="warehouse-panel">
    <template #header>
      <UDashboardNavbar title="Warehouse Storage (WMS)" icon="i-lucide-warehouse">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
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
            icon="i-lucide-package-plus"
            @click="openReceiveModal()"
          >
            Receive Cargo
          </UButton>
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <template #left>
          <div class="flex flex-wrap items-center gap-1.5">
            <UButton
              v-for="z in zones"
              :key="z.value"
              size="xs"
              :color="selectedZone === z.value ? 'primary' : 'neutral'"
              :variant="selectedZone === z.value ? 'solid' : 'ghost'"
              @click="selectedZone = z.value"
            >
              {{ z.label }}
            </UButton>
          </div>
        </template>
        <template #right>
          <UButton
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-refresh-cw"
            :loading="loading"
            @click="fetchAll()"
          >
            Refresh
          </UButton>
        </template>
      </UDashboardToolbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <!-- Zone KPI Strip -->
        <div v-if="utilization" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <UCard>
            <p class="text-xs font-medium text-muted">Overall Bin Utilization</p>
            <p class="mt-1 text-2xl font-bold text-highlighted">
              {{ utilization.overallUtilizationPercent }}%
            </p>
            <UProgress class="mt-2" :model-value="utilization.overallUtilizationPercent" size="xs" />
          </UCard>

          <UCard>
            <p class="text-xs font-medium text-muted">Available Stock Units</p>
            <p class="mt-1 text-2xl font-bold text-success">
              {{ utilization.availableCargoUnits }}
            </p>
            <p class="mt-1 text-xs text-muted">Ready for dispatch allocation</p>
          </UCard>

          <UCard>
            <p class="text-xs font-medium text-muted">Allocated to Shipments</p>
            <p class="mt-1 text-2xl font-bold text-warning">
              {{ utilization.allocatedCargoUnits }}
            </p>
            <p class="mt-1 text-xs text-muted">Reserved via Delivery ACL</p>
          </UCard>

          <UCard>
            <p class="text-xs font-medium text-muted">Bins Near Threshold (≥85%)</p>
            <p class="mt-1 text-2xl font-bold text-highlighted">
              {{ utilization.binsNearCapacity }} / {{ utilization.totalBins }}
            </p>
            <p class="mt-1 text-xs text-muted">Emits BinThresholdReached</p>
          </UCard>
        </div>

        <!-- Bin Cards Grid -->
        <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <WarehouseBinCard
            v-for="bin in filteredBins"
            :key="bin.id"
            :bin="bin"
            @receive-into-bin="openReceiveModal"
            @release-cargo="releaseCargo"
          />
        </div>

        <!-- Inventory Ledger Table -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-sm font-semibold text-highlighted">
                  Stored Cargo Inventory Ledger
                </h2>
                <p class="text-xs text-muted">
                  Owned exclusively by <code>modules/warehouse/</code> — exposed to Delivery only via <code>WarehousePublicFacade</code>.
                </p>
              </div>
              <UBadge color="neutral" variant="subtle">
                {{ allCargoRows.length }} units
              </UBadge>
            </div>
          </template>

          <UTable :data="allCargoRows" :columns="cargoColumns" />
        </UCard>
      </div>

      <WarehouseReceiveCargoModal
        v-model:open="receiveModalOpen"
        :bins="bins"
        :default-bin-id="selectedBinIdForModal"
      />
    </template>
  </UDashboardPanel>
</template>
