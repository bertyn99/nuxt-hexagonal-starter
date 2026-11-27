<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { receiveWarehouseCargoAbility } from '../../../../shared/abilities/warehouse.abilities'
import type {
  HandlingClassDto,
  StorageZoneDto,
  StoredCargoDto,
} from '../../../../shared/types/warehouse'

definePageMeta({
  title: 'Warehouse Storage (WMS)',
})

const { releaseCargo } = useWarehouse()
const { open: openInspector } = useHexInspector()

const [binsQuery, utilizationQuery] = await Promise.all([
  useWarehouseBins(),
  useWarehouseUtilization(),
])

const bins = computed(() => binsQuery.data.value ?? [])
const utilization = computed(() => utilizationQuery.data.value ?? null)
const loading = computed(
  () => binsQuery.status.value === 'pending' || utilizationQuery.status.value === 'pending',
)
const loadError = computed(() => {
  const err = binsQuery.error.value ?? utilizationQuery.error.value
  return err ? formatApiError(err, 'Failed to load warehouse inventory').details : null
})

const selectedZone = shallowRef<StorageZoneDto | 'ALL'>('ALL')
const searchQuery = shallowRef('')
const receiveModalOpen = shallowRef(false)
const selectedBinIdForModal = shallowRef<string | undefined>(undefined)

async function refreshWarehouse() {
  await Promise.all([binsQuery.refresh(), utilizationQuery.refresh()])
}

const zoneTabs = computed(() => {
  const counts: Record<StorageZoneDto, number> = {
    AMBIENT: 0,
    COLD_CHAIN: 0,
    HAZMAT: 0,
  }
  for (const bin of bins.value) {
    counts[bin.zone] += 1
  }
  return [
    { label: 'All Zones', value: 'ALL', badge: String(bins.value.length) },
    { label: 'Ambient', value: 'AMBIENT', badge: String(counts.AMBIENT) },
    { label: 'Cold Chain', value: 'COLD_CHAIN', badge: String(counts.COLD_CHAIN) },
    { label: 'Hazmat', value: 'HAZMAT', badge: String(counts.HAZMAT) },
  ]
})

const filteredBins = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return bins.value.filter(bin => {
    if (selectedZone.value !== 'ALL' && bin.zone !== selectedZone.value) {
      return false
    }
    if (!q) {
      return true
    }
    return (
      bin.code.toLowerCase().includes(q) ||
      bin.storedCargo.some(
        cargo =>
          cargo.sku.toLowerCase().includes(q) ||
          cargo.label.toLowerCase().includes(q) ||
          cargo.handlingClass.toLowerCase().includes(q),
      )
    )
  })
})

interface FlattenedCargoRow extends StoredCargoDto {
  binCode: string
  zone: StorageZoneDto
}

const allCargoRows = computed<FlattenedCargoRow[]>(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return filteredBins.value.flatMap(bin =>
    bin.storedCargo
      .filter(
        cargo =>
          !q ||
          bin.code.toLowerCase().includes(q) ||
          cargo.sku.toLowerCase().includes(q) ||
          cargo.label.toLowerCase().includes(q) ||
          cargo.handlingClass.toLowerCase().includes(q),
      )
      .map(cargo => ({
        ...cargo,
        binCode: bin.code,
        zone: bin.zone,
      })),
  )
})

const handlingColor: Record<HandlingClassDto, 'neutral' | 'warning' | 'info' | 'error'> = {
  STANDARD: 'neutral',
  FRAGILE: 'warning',
  COLD_CHAIN: 'info',
  HAZMAT: 'error',
}

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

function resetFilters() {
  selectedZone.value = 'ALL'
  searchQuery.value = ''
}

async function handleReleaseCargo(cargoId: string) {
  try {
    await releaseCargo(cargoId)
  } catch {
    // Domain rejection toast is surfaced automatically by useWarehouse()
  }
}
</script>

<template>
  <UDashboardPanel id="warehouse-panel" class="min-w-0">
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
          <Can :ability="receiveWarehouseCargoAbility">
            <UButton
              size="sm"
              color="primary"
              icon="i-lucide-package-plus"
              @click="openReceiveModal()"
            >
              Receive Cargo
            </UButton>
          </Can>
          <Cannot :ability="receiveWarehouseCargoAbility">
            <UButton size="sm" color="neutral" variant="subtle" icon="i-lucide-lock" to="/login">
              Sign in (WMS Role)
            </UButton>
          </Cannot>
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <template #left>
          <UTabs
            v-model="selectedZone"
            :items="zoneTabs"
            :content="false"
            size="xs"
            color="neutral"
          />
        </template>
        <template #right>
          <div class="flex items-center gap-2">
            <UInput
              v-model="searchQuery"
              icon="i-lucide-search"
              placeholder="Filter bins, SKU, label..."
              size="xs"
              class="w-48 sm:w-60"
            />
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-lucide-refresh-cw"
              :loading="loading"
              @click="refreshWarehouse"
            >
              Refresh
            </UButton>
          </div>
        </template>
      </UDashboardToolbar>
    </template>

    <template #body>
      <div class="mx-auto max-w-[1440px] space-y-6">
        <UAlert
          v-if="loadError"
          color="error"
          variant="subtle"
          icon="i-lucide-alert-circle"
          title="Unable to load warehouse bins"
          :description="loadError"
          :actions="[
            { label: 'Retry', color: 'error', variant: 'outline', onClick: refreshWarehouse },
          ]"
        />

        <!-- Unified Telemetry Strip -->
        <section
          v-if="utilization"
          aria-label="Warehouse Utilization Metrics"
          class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-default rounded-lg border border-default bg-elevated/30"
        >
          <div class="p-4 space-y-2">
            <div class="flex items-center justify-between text-xs text-muted">
              <span class="font-medium">Overall Bin Utilization</span>
              <span class="font-mono font-semibold text-highlighted tabular-nums"
                >{{ utilization.overallUtilizationPercent }}%</span
              >
            </div>
            <UProgress :model-value="utilization.overallUtilizationPercent" size="sm" />
            <p class="text-[11px] text-muted tabular-nums">
              Across {{ utilization.totalBins }} configured bays
            </p>
          </div>

          <div class="p-4 flex flex-col justify-between gap-1">
            <span class="text-xs font-medium text-muted">Available Stock Units</span>
            <p class="text-2xl font-semibold tabular-nums text-success">
              {{ utilization.availableCargoUnits }}
            </p>
            <p class="text-[11px] text-muted">Ready for dispatch allocation</p>
          </div>

          <div class="p-4 flex flex-col justify-between gap-1">
            <span class="text-xs font-medium text-muted">Allocated to Shipments</span>
            <p class="text-2xl font-semibold tabular-nums text-warning">
              {{ utilization.allocatedCargoUnits }}
            </p>
            <p class="text-[11px] text-muted">Reserved via Delivery ACL</p>
          </div>

          <div class="p-4 flex flex-col justify-between gap-1">
            <span class="text-xs font-medium text-muted">Bins Near Threshold (≥85%)</span>
            <p class="text-2xl font-semibold tabular-nums text-highlighted">
              {{ utilization.binsNearCapacity }}
              <span class="text-sm font-normal text-muted">/ {{ utilization.totalBins }}</span>
            </p>
            <p class="text-[11px] text-muted">Emits BinThresholdReached</p>
          </div>
        </section>

        <!-- Bin Cards Grid -->
        <div v-if="filteredBins.length > 0" class="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <WarehouseBinCard
            v-for="bin in filteredBins"
            :key="bin.id"
            :bin="bin"
            @receive-into-bin="openReceiveModal"
            @release-cargo="handleReleaseCargo"
          />
        </div>

        <UEmpty
          v-else
          icon="i-lucide-warehouse"
          title="No storage bays match your filter"
          description="Clear the search query or switch back to All Zones to inspect all warehouse bays."
          :actions="[
            { label: 'Reset filters', color: 'neutral', variant: 'outline', onClick: resetFilters },
          ]"
        />

        <!-- Inventory Ledger Table -->
        <UCard :ui="{ body: 'p-0 overflow-x-auto' }">
          <template #header>
            <div class="flex items-center justify-between gap-2">
              <div>
                <h2 class="text-sm font-semibold text-highlighted">
                  Stored Cargo Inventory Ledger
                </h2>
                <p class="text-xs text-muted">
                  Owned exclusively by <code>modules/warehouse/</code> — exposed to Delivery only
                  via <code>WarehousePublicFacade</code>.
                </p>
              </div>
              <UBadge color="neutral" variant="subtle" class="tabular-nums">
                {{ allCargoRows.length }} units
              </UBadge>
            </div>
          </template>

          <UTable :data="allCargoRows" :columns="cargoColumns" :loading="loading">
            <template #binCode-cell="{ row }">
              <span class="font-mono text-xs font-semibold text-highlighted">{{
                row.original.binCode
              }}</span>
            </template>

            <template #kind-cell="{ row }">
              <UBadge
                :color="row.original.kind === 'PALLET' ? 'primary' : 'neutral'"
                variant="outline"
                size="xs"
                :icon="row.original.kind === 'PALLET' ? 'i-lucide-layers' : 'i-lucide-box'"
              >
                {{ row.original.kind }}
              </UBadge>
            </template>

            <template #label-cell="{ row }">
              <div>
                <p class="text-xs font-medium text-highlighted">{{ row.original.label }}</p>
                <p class="font-mono text-[11px] text-muted">{{ row.original.sku }}</p>
              </div>
            </template>

            <template #handlingClass-cell="{ row }">
              <UBadge :color="handlingColor[row.original.handlingClass]" variant="subtle" size="xs">
                {{ row.original.handlingClass }}
              </UBadge>
            </template>

            <template #weightKg-cell="{ row }">
              <span class="font-mono text-xs tabular-nums">{{ row.original.weightKg }}</span>
            </template>

            <template #volumeM3-cell="{ row }">
              <span class="font-mono text-xs tabular-nums">{{ row.original.volumeM3 }}</span>
            </template>

            <template #status-cell="{ row }">
              <UBadge
                :color="row.original.status === 'ALLOCATED' ? 'warning' : 'success'"
                variant="soft"
                size="xs"
              >
                {{ row.original.status }}
              </UBadge>
            </template>

            <template #empty>
              <UEmpty
                variant="naked"
                size="sm"
                icon="i-lucide-package-open"
                title="No cargo units match the current filter"
                description="Try clearing your search or receive new cargo into an open bay."
              />
            </template>
          </UTable>
        </UCard>
      </div>

      <LazyWarehouseReceiveCargoModal
        v-if="receiveModalOpen"
        v-model:open="receiveModalOpen"
        :bins="bins"
        :default-bin-id="selectedBinIdForModal"
      />
    </template>
  </UDashboardPanel>
</template>
