import type {
  StorageZoneDto,
  WarehouseBinDto,
  WarehouseUtilizationDto,
} from '../../../shared/types/warehouse'
import type { ReceiveCargoRequest } from '../../../shared/schemas/warehouse.schema'

export function useWarehouse() {
  const toast = useToast()

  const bins = useState<WarehouseBinDto[]>('warehouse-bins', () => [])
  const utilization = useState<WarehouseUtilizationDto | null>('warehouse-utilization', () => null)
  const loading = useState<boolean>('warehouse-loading', () => false)

  async function fetchAll(zone?: StorageZoneDto) {
    loading.value = true
    try {
      const [binsRes, utilRes] = await Promise.all([
        $fetch<WarehouseBinDto[]>('/api/warehouse/bins', {
          query: zone ? { zone } : undefined,
        }),
        $fetch<WarehouseUtilizationDto>('/api/warehouse/utilization'),
      ])
      bins.value = binsRes
      utilization.value = utilRes
    }
    finally {
      loading.value = false
    }
  }

  async function receiveCargo(payload: ReceiveCargoRequest) {
    try {
      const res = await $fetch<{ bin: WarehouseBinDto, storedCargoId: string }>('/api/warehouse/cargo', {
        method: 'POST',
        body: payload,
      })
      toast.add({
        title: `${payload.kind === 'PALLET' ? 'Composite Pallet' : 'Parcel'} stored in ${res.bin.code}`,
        description: `${payload.label} (${res.storedCargoId})`,
        color: 'success',
        icon: 'i-lucide-package-check',
      })
      await fetchAll()
      return res
    }
    catch (err: unknown) {
      const fetchErr = err as { data?: { statusMessage?: string, data?: { code?: string } }, statusMessage?: string, message?: string }
      const code = fetchErr?.data?.data?.code ?? 'DOMAIN_RULE_VIOLATION'
      const msg = fetchErr?.data?.statusMessage ?? fetchErr?.statusMessage ?? fetchErr?.message ?? 'Failed to store cargo'
      toast.add({
        title: `Storage Rejected (${code})`,
        description: msg,
        color: 'error',
        icon: 'i-lucide-shield-alert',
      })
      throw err
    }
  }

  async function releaseCargo(cargoId: string) {
    try {
      const res = await $fetch<{ bin: WarehouseBinDto, releasedCargoId: string }>(
        `/api/warehouse/cargo/${encodeURIComponent(cargoId)}/release`,
        { method: 'POST' },
      )
      toast.add({
        title: `Cargo released from ${res.bin.code}`,
        description: `Removed cargo unit ${res.releasedCargoId}`,
        color: 'info',
        icon: 'i-lucide-package-minus',
      })
      await fetchAll()
      return res
    }
    catch (err: unknown) {
      const fetchErr = err as { data?: { statusMessage?: string }, message?: string }
      toast.add({
        title: 'Release failed',
        description: fetchErr?.data?.statusMessage ?? fetchErr?.message ?? 'Unable to release cargo',
        color: 'error',
      })
      throw err
    }
  }

  return {
    bins,
    utilization,
    loading,
    fetchAll,
    receiveCargo,
    releaseCargo,
  }
}
