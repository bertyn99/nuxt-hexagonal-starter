import type {
  StorageZoneDto,
  WarehouseBinDto,
  WarehouseUtilizationDto,
} from '../../../shared/types/warehouse'
import type { ReceiveCargoRequest } from '../../../shared/schemas/warehouse.schema'

function formatClientError(err: unknown, fallbackMessage: string) {
  const parsed = parseError(err)
  const code = parsed.code ?? (typeof parsed.data?.code === 'string' ? parsed.data.code : 'DOMAIN_RULE_VIOLATION')
  const details = [parsed.why ?? parsed.message ?? fallbackMessage, parsed.fix ? `Fix: ${parsed.fix}` : null]
    .filter(Boolean)
    .join(' — ')
  return { parsed, code, details }
}

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
      const { parsed, code, details } = formatClientError(err, 'Failed to store cargo')
      log.error({
        action: 'warehouse_receive_cargo_failed',
        code,
        status: parsed.status,
        binId: payload.binId,
        sku: payload.sku,
      })
      toast.add({
        title: `Storage Rejected (${code})`,
        description: details,
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
      const { parsed, code, details } = formatClientError(err, 'Unable to release cargo')
      log.error({
        action: 'warehouse_release_cargo_failed',
        code,
        status: parsed.status,
        cargoId,
      })
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
    loading,
    fetchAll,
    receiveCargo,
    releaseCargo,
  }
}
