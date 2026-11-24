import type {
  AvailableCargoDto,
  CarrierModeDto,
  DeliveryQuoteDto,
  ShipmentDto,
  ShipmentStateDto,
  ShipmentTimelineDto,
} from '../../../shared/types/delivery'
import type { CreateShipmentRequest, QuoteShipmentRequest } from '../../../shared/schemas/delivery.schema'

export function useDeliveries() {
  const toast = useToast()

  const shipments = useState<ShipmentDto[]>('delivery-shipments', () => [])
  const availableCargo = useState<AvailableCargoDto[]>('delivery-available-cargo', () => [])
  const loading = useState<boolean>('delivery-loading', () => false)

  function extractError(err: unknown): { code: string, message: string } {
    const e = err as {
      data?: { statusMessage?: string, data?: { code?: string } }
      statusMessage?: string
      message?: string
    }
    return {
      code: e?.data?.data?.code ?? 'DOMAIN_RULE_VIOLATION',
      message: e?.data?.statusMessage ?? e?.statusMessage ?? e?.message ?? 'Operation failed',
    }
  }

  async function fetchShipments(filters?: {
    state?: ShipmentStateDto
    carrierMode?: CarrierModeDto
    slaBreachedOnly?: boolean
  }) {
    loading.value = true
    try {
      shipments.value = await $fetch<ShipmentDto[]>('/api/deliveries', {
        query: {
          state: filters?.state,
          carrierMode: filters?.carrierMode,
          slaBreached: filters?.slaBreachedOnly ? 'true' : undefined,
        },
      })
    }
    finally {
      loading.value = false
    }
  }

  async function fetchAvailableCargo() {
    availableCargo.value = await $fetch<AvailableCargoDto[]>('/api/deliveries/available-cargo')
    return availableCargo.value
  }

  async function quoteShipment(payload: QuoteShipmentRequest) {
    return await $fetch<DeliveryQuoteDto>('/api/deliveries/quote', {
      method: 'POST',
      body: payload,
    })
  }

  async function createShipment(payload: CreateShipmentRequest) {
    try {
      const created = await $fetch<ShipmentDto>('/api/deliveries', {
        method: 'POST',
        body: payload,
      })
      toast.add({
        title: `Shipment ${created.trackingNumber} created`,
        description: `Allocated from ${created.originBinCode} • Quote ${created.quotedCostFormatted}`,
        color: 'success',
        icon: 'i-lucide-truck',
      })
      await Promise.all([fetchShipments(), fetchAvailableCargo()])
      return created
    }
    catch (err: unknown) {
      const { code, message } = extractError(err)
      toast.add({
        title: `Shipment Rejected (${code})`,
        description: message,
        color: 'error',
        icon: 'i-lucide-shield-alert',
      })
      throw err
    }
  }

  async function runTransition(
    shipmentId: string,
    endpoint: 'dispatch' | 'advance' | 'deliver' | 'fail-attempt' | 'cancel',
    body?: Record<string, unknown>,
  ) {
    try {
      const res = await $fetch<ShipmentDto | { shipment: ShipmentDto, resolution: { action: string, note: string } }>(
        `/api/deliveries/${encodeURIComponent(shipmentId)}/${endpoint}`,
        {
          method: 'POST',
          body,
        },
      )

      if ('resolution' in res) {
        toast.add({
          title: `Delivery Exception: ${res.resolution.action}`,
          description: res.resolution.note,
          color: res.shipment.state === 'ReturnedToWarehouse' ? 'error' : 'warning',
          icon: 'i-lucide-alert-octagon',
        })
      }
      else {
        toast.add({
          title: `${res.trackingNumber} → ${res.state}`,
          description: res.carrierReference ? `Carrier Ref: ${res.carrierReference}` : `Updated state to ${res.state}`,
          color: res.state === 'Delivered' ? 'success' : 'info',
          icon: res.state === 'Delivered' ? 'i-lucide-check-circle-2' : 'i-lucide-arrow-right-circle',
        })
      }

      await Promise.all([fetchShipments(), fetchAvailableCargo()])
      return res
    }
    catch (err: unknown) {
      const { code, message } = extractError(err)
      toast.add({
        title: `Domain Guard Blocked Action (${code})`,
        description: message,
        color: 'error',
        icon: 'i-lucide-shield-ban',
      })
      throw err
    }
  }

  async function fetchTimeline(shipmentId: string) {
    return await $fetch<ShipmentTimelineDto>(`/api/deliveries/${encodeURIComponent(shipmentId)}/timeline`)
  }

  return {
    shipments,
    availableCargo,
    loading,
    fetchShipments,
    fetchAvailableCargo,
    quoteShipment,
    createShipment,
    runTransition,
    fetchTimeline,
  }
}
