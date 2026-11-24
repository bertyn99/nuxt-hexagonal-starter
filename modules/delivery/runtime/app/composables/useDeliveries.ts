import type { AvailableCargoDto, ShipmentDto } from '../../../shared/types/delivery'
import type { CreateShipmentRequest } from '../../../shared/schemas/delivery.schema'

export function useDeliveryShipments() {
  return useAPI<ShipmentDto[]>('/api/deliveries', {
    key: API_CACHE_KEYS.deliveryShipments,
    default: () => [],
  })
}

export function useAvailableCargo() {
  return useAPI<AvailableCargoDto[]>('/api/deliveries/available-cargo', {
    key: API_CACHE_KEYS.deliveryAvailableCargo,
    default: () => [],
  })
}

export function useDeliveries() {
  const { $api } = useNuxtApp()
  const toast = useToast()

  const { data: shipmentsData } = useNuxtData<ShipmentDto[]>(API_CACHE_KEYS.deliveryShipments)
  const { data: availableCargoData } = useNuxtData<AvailableCargoDto[]>(
    API_CACHE_KEYS.deliveryAvailableCargo,
  )

  const shipments = computed<readonly ShipmentDto[]>(() => shipmentsData.value ?? [])
  const availableCargo = computed<readonly AvailableCargoDto[]>(
    () => availableCargoData.value ?? [],
  )

  async function ensureShipmentsLoaded() {
    if (shipmentsData.value !== undefined) {
      return
    }
    shipmentsData.value = await $api<ShipmentDto[]>('/api/deliveries')
  }

  async function invalidateAfterMutation() {
    clearNuxtData([
      API_CACHE_KEYS.warehouseBins,
      API_CACHE_KEYS.warehouseUtilization,
      API_CACHE_KEYS.hexInspector,
    ])
    await refreshNuxtData([
      API_CACHE_KEYS.deliveryShipments,
      API_CACHE_KEYS.deliveryAvailableCargo,
      API_CACHE_KEYS.warehouseBins,
      API_CACHE_KEYS.warehouseUtilization,
      API_CACHE_KEYS.hexInspector,
    ])
  }

  async function createShipment(
    payload: CreateShipmentRequest,
    options?: { silentErrorToast?: boolean },
  ) {
    try {
      const created = await $api<ShipmentDto>('/api/deliveries', {
        method: 'POST',
        body: payload,
      })
      toast.add({
        title: `Shipment ${created.trackingNumber} created`,
        description: `Allocated from ${created.originBinCode} • Quote ${created.quotedCostFormatted}`,
        color: 'success',
        icon: 'i-lucide-truck',
      })
      await invalidateAfterMutation()
      return created
    } catch (err: unknown) {
      if (!options?.silentErrorToast) {
        const { code, details } = formatApiError(err, 'Failed to create shipment')
        toast.add({
          title: `Shipment Rejected (${code})`,
          description: details,
          color: 'error',
          icon: 'i-lucide-shield-alert',
        })
      }
      throw err
    }
  }

  async function runTransition(
    shipmentId: string,
    endpoint: 'dispatch' | 'advance' | 'deliver' | 'fail-attempt' | 'cancel',
    body?: Record<string, unknown>,
  ) {
    try {
      const res = await $api<
        ShipmentDto | { shipment: ShipmentDto; resolution: { action: string; note: string } }
      >(`/api/deliveries/${encodeURIComponent(shipmentId)}/${endpoint}`, {
        method: 'POST',
        body,
      })

      if ('resolution' in res) {
        toast.add({
          title: `Delivery Exception: ${res.resolution.action}`,
          description: res.resolution.note,
          color: res.shipment.state === 'ReturnedToWarehouse' ? 'error' : 'warning',
          icon: 'i-lucide-alert-octagon',
        })
      } else {
        toast.add({
          title: `${res.trackingNumber} → ${res.state}`,
          description: res.carrierReference
            ? `Carrier Ref: ${res.carrierReference}`
            : `Updated state to ${res.state}`,
          color: res.state === 'Delivered' ? 'success' : 'info',
          icon:
            res.state === 'Delivered' ? 'i-lucide-check-circle-2' : 'i-lucide-arrow-right-circle',
        })
      }

      await invalidateAfterMutation()
      return res
    } catch (err: unknown) {
      const { code, details } = formatApiError(err, 'Transition failed')
      toast.add({
        title: `Domain Guard Blocked Action (${code})`,
        description: details,
        color: 'error',
        icon: 'i-lucide-shield-ban',
      })
      throw err
    }
  }

  return {
    shipments,
    availableCargo,
    ensureShipmentsLoaded,
    createShipment,
    runTransition,
  }
}
