import type { WarehouseBinDto, WarehouseUtilizationDto } from '../../../shared/types/warehouse'
import type { ReceiveCargoRequest } from '../../../shared/schemas/warehouse.schema'

export function useWarehouseBins() {
  return useAPI<WarehouseBinDto[]>('/api/warehouse/bins', {
    key: API_CACHE_KEYS.warehouseBins,
    default: () => [],
  })
}

export function useWarehouseUtilization() {
  return useAPI<WarehouseUtilizationDto | null>('/api/warehouse/utilization', {
    key: API_CACHE_KEYS.warehouseUtilization,
    default: () => null,
  })
}

export function useWarehouse() {
  const { $api } = useNuxtApp()
  const toast = useToast()

  const { data: binsData } = useNuxtData<WarehouseBinDto[]>(API_CACHE_KEYS.warehouseBins)
  const { data: utilizationData } = useNuxtData<WarehouseUtilizationDto | null>(
    API_CACHE_KEYS.warehouseUtilization,
  )

  const bins = computed<readonly WarehouseBinDto[]>(() => binsData.value ?? [])
  const utilization = computed(() => utilizationData.value ?? null)

  async function ensureBinsLoaded() {
    if (binsData.value !== undefined) {
      return
    }
    binsData.value = await $api<WarehouseBinDto[]>('/api/warehouse/bins')
  }

  async function refreshAll() {
    await refreshNuxtData([API_CACHE_KEYS.warehouseBins, API_CACHE_KEYS.warehouseUtilization])
  }

  async function invalidateAfterMutation() {
    clearNuxtData([API_CACHE_KEYS.deliveryAvailableCargo, API_CACHE_KEYS.hexInspector])
    await refreshNuxtData([
      API_CACHE_KEYS.warehouseBins,
      API_CACHE_KEYS.warehouseUtilization,
      API_CACHE_KEYS.deliveryAvailableCargo,
      API_CACHE_KEYS.hexInspector,
    ])
  }

  async function receiveCargo(
    payload: ReceiveCargoRequest,
    options?: { silentErrorToast?: boolean },
  ) {
    try {
      const res = await $api<{ bin: WarehouseBinDto; storedCargoId: string }>(
        '/api/warehouse/cargo',
        {
          method: 'POST',
          body: payload,
        },
      )
      toast.add({
        title: `${payload.kind === 'PALLET' ? 'Composite Pallet' : 'Parcel'} stored in ${res.bin.code}`,
        description: `${payload.label} (${res.storedCargoId})`,
        color: 'success',
        icon: 'i-lucide-package-check',
      })
      await invalidateAfterMutation()
      return res
    } catch (err: unknown) {
      if (!options?.silentErrorToast) {
        const { code, details } = formatApiError(err, 'Failed to store cargo')
        toast.add({
          title: `Storage Rejected (${code})`,
          description: details,
          color: 'error',
          icon: 'i-lucide-shield-alert',
        })
      }
      throw err
    }
  }

  async function releaseCargo(cargoId: string) {
    try {
      const res = await $api<{ bin: WarehouseBinDto; releasedCargoId: string }>(
        `/api/warehouse/cargo/${encodeURIComponent(cargoId)}/release`,
        { method: 'POST' },
      )
      toast.add({
        title: `Cargo released from ${res.bin.code}`,
        description: `Removed cargo unit ${res.releasedCargoId}`,
        color: 'info',
        icon: 'i-lucide-package-minus',
      })
      await invalidateAfterMutation()
      return res
    } catch (err: unknown) {
      const { code, details } = formatApiError(err, 'Unable to release cargo')
      toast.add({
        title: `Release failed (${code})`,
        description: details,
        color: 'error',
      })
      throw err
    }
  }

  return {
    bins,
    utilization,
    ensureBinsLoaded,
    refreshAll,
    receiveCargo,
    releaseCargo,
  }
}
