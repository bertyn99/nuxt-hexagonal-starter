import type { InspectorSnapshotDto } from '../../../shared/types/inspector'

export function useHexInspectorSnapshot() {
  return useAPI<InspectorSnapshotDto | null>('/api/_hexagonal/inspector', {
    key: API_CACHE_KEYS.hexInspector,
    default: () => null,
  })
}

export function useHexInspector() {
  const { $api } = useNuxtApp()
  const toast = useToast()

  const isOpen = useState<boolean>('hex-inspector-open', () => false)
  const { data: snapshotData } = useNuxtData<InspectorSnapshotDto | null>(
    API_CACHE_KEYS.hexInspector,
  )
  const mutating = shallowRef(false)

  const snapshot = computed(() => snapshotData.value ?? null)

  async function refresh() {
    await refreshNuxtData(API_CACHE_KEYS.hexInspector)
  }

  async function advanceClock(hours: number) {
    mutating.value = true
    try {
      const updated = await $api<InspectorSnapshotDto>('/api/_hexagonal/clock', {
        method: 'POST',
        body: { action: 'advance', hours },
      })
      snapshotData.value = updated
      toast.add({
        title: `Virtual clock advanced +${hours}h`,
        description: `Simulated time is now ${new Date(updated.clock.currentTimeIso).toLocaleString()}`,
        color: 'info',
        icon: 'i-lucide-clock',
      })
    } catch (err: unknown) {
      const { details } = formatApiError(err, 'Failed to advance clock')
      toast.add({ title: 'Clock error', description: details, color: 'error' })
    } finally {
      mutating.value = false
    }
  }

  async function resetClock() {
    mutating.value = true
    try {
      const updated = await $api<InspectorSnapshotDto>('/api/_hexagonal/clock', {
        method: 'POST',
        body: { action: 'reset' },
      })
      snapshotData.value = updated
      toast.add({
        title: 'Virtual clock reset',
        description: 'Returned to live wall-clock time',
        color: 'neutral',
        icon: 'i-lucide-rotate-ccw',
      })
    } catch (err: unknown) {
      const { details } = formatApiError(err, 'Failed to reset clock')
      toast.add({ title: 'Clock reset failed', description: details, color: 'error' })
    } finally {
      mutating.value = false
    }
  }

  async function updateFaults(payload: { outageEnabled?: boolean; extraDelayHours?: number }) {
    mutating.value = true
    try {
      const updated = await $api<InspectorSnapshotDto>('/api/_hexagonal/fault', {
        method: 'POST',
        body: payload,
      })
      snapshotData.value = updated
      toast.add({
        title: 'Carrier fault simulation updated',
        description: updated.faults.outageEnabled
          ? 'Simulated carrier outage is ACTIVE (dispatches will fail with 503)'
          : `Outage disabled • Extra delay: +${updated.faults.extraDelayHours}h`,
        color: updated.faults.outageEnabled ? 'warning' : 'success',
        icon: 'i-lucide-zap',
      })
    } catch (err: unknown) {
      const { details } = formatApiError(err, 'Failed to update carrier faults')
      toast.add({ title: 'Fault update failed', description: details, color: 'error' })
    } finally {
      mutating.value = false
    }
  }

  async function evaluateSlas() {
    mutating.value = true
    try {
      const result = await $api<{
        evaluatedCount: number
        newlyBreachedCount: number
        breachedTrackingNumbers: string[]
      }>('/api/deliveries/evaluate-slas', { method: 'POST' })
      toast.add({
        title: 'SLA Evaluation Complete',
        description:
          result.newlyBreachedCount > 0
            ? `${result.newlyBreachedCount} shipment(s) breached SLA: ${result.breachedTrackingNumbers.join(', ')}`
            : `Evaluated ${result.evaluatedCount} active shipment(s); no new SLA breaches.`,
        color: result.newlyBreachedCount > 0 ? 'error' : 'success',
        icon: result.newlyBreachedCount > 0 ? 'i-lucide-alert-triangle' : 'i-lucide-shield-check',
      })
      await refreshNuxtData([API_CACHE_KEYS.hexInspector, API_CACHE_KEYS.deliveryShipments])
      return result
    } catch (err: unknown) {
      const { details } = formatApiError(err, 'SLA evaluation failed')
      toast.add({ title: 'SLA Evaluation Failed', description: details, color: 'error' })
      return null
    } finally {
      mutating.value = false
    }
  }

  function open() {
    isOpen.value = true
  }

  return {
    isOpen,
    snapshot,
    mutating: readonly(mutating),
    refresh,
    open,
    advanceClock,
    resetClock,
    updateFaults,
    evaluateSlas,
  }
}
