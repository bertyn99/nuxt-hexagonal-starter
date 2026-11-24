import type {
  AvailableCargoDto,
  CarrierModeDto,
  DeliveryQuoteDto,
  ShipmentDto,
  ShipmentStateDto,
  ShipmentTimelineDto,
} from '../../../shared/types/delivery'
import type { CreateShipmentRequest, QuoteShipmentRequest } from '../../../shared/schemas/delivery.schema'

function formatClientError(err: unknown, fallbackMessage: string) {
  const parsed = parseError(err)
  const code = parsed.code ?? (typeof parsed.data?.code === 'string' ? parsed.data.code : 'DOMAIN_RULE_VIOLATION')
  const details = [parsed.why ?? parsed.message ?? fallbackMessage, parsed.fix ? `Fix: ${parsed.fix}` : null]
    .filter(Boolean)
    .join(' — ')
  return { parsed, code, details }
}

export function useDeliveries() {
  const toast = useToast()

  const shipments = useState<ShipmentDto[]>('delivery-shipments', () => [])
  const availableCargo = useState<AvailableCargoDto[]>('delivery-available-cargo', () => [])
  const loading = useState<boolean>('delivery-loading', () => false)

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
      const { parsed, code, details } = formatClientError(err, 'Failed to create shipment')
      log.error({
        action: 'delivery_create_shipment_failed',
        code,
        status: parsed.status,
        cargoId: payload.cargoId,
        carrierMode: payload.carrierMode,
      })
      toast.add({
        title: `Shipment Rejected (${code})`,
        description: details,
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
      const { parsed, code, details } = formatClientError(err, 'Transition failed')
      log.error({
        action: 'delivery_transition_failed',
        endpoint,
        shipmentId,
        code,
        status: parsed.status,
      })
      toast.add({
        title: `Domain Guard Blocked Action (${code})`,
        description: details,
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
