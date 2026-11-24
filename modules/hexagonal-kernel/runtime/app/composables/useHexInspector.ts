import type { InspectorSnapshotDto } from '../../../shared/types/inspector'

export function useHexInspector() {
  const isOpen = useState<boolean>('hex-inspector-open', () => false)
  const snapshot = useState<InspectorSnapshotDto | null>('hex-inspector-snapshot', () => null)
  const loading = useState<boolean>('hex-inspector-loading', () => false)
  const toast = useToast()

  async function refresh() {
    loading.value = true
    try {
      snapshot.value = await $fetch<InspectorSnapshotDto>('/api/_hexagonal/inspector')
    }
    finally {
      loading.value = false
    }
  }

  async function advanceClock(hours: number) {
    loading.value = true
    try {
      snapshot.value = await $fetch<InspectorSnapshotDto>('/api/_hexagonal/clock', {
        method: 'POST',
        body: { action: 'advance', hours },
      })
      toast.add({
        title: `Virtual clock advanced +${hours}h`,
        description: `Simulated time is now ${new Date(snapshot.value.clock.currentTimeIso).toLocaleString()}`,
        color: 'info',
        icon: 'i-lucide-clock',
      })
    }
    catch (err: unknown) {
      const msg = (err as { data?: { statusMessage?: string }, message?: string })?.data?.statusMessage
        ?? (err as Error)?.message
        ?? 'Failed to advance clock'
      toast.add({ title: 'Clock error', description: msg, color: 'error' })
    }
    finally {
      loading.value = false
    }
  }

  async function resetClock() {
    loading.value = true
    try {
      snapshot.value = await $fetch<InspectorSnapshotDto>('/api/_hexagonal/clock', {
        method: 'POST',
        body: { action: 'reset' },
      })
      toast.add({
        title: 'Virtual clock reset',
        description: 'Returned to live wall-clock time',
        color: 'neutral',
        icon: 'i-lucide-rotate-ccw',
      })
    }
    finally {
      loading.value = false
    }
  }

  async function updateFaults(payload: { outageEnabled?: boolean, extraDelayHours?: number }) {
    loading.value = true
    try {
      snapshot.value = await $fetch<InspectorSnapshotDto>('/api/_hexagonal/fault', {
        method: 'POST',
        body: payload,
      })
      toast.add({
        title: 'Carrier fault simulation updated',
        description: snapshot.value.faults.outageEnabled
          ? 'Simulated carrier outage is ACTIVE (dispatches will fail with 503)'
          : `Outage disabled • Extra delay: +${snapshot.value.faults.extraDelayHours}h`,
        color: snapshot.value.faults.outageEnabled ? 'warning' : 'success',
        icon: 'i-lucide-zap',
      })
    }
    finally {
      loading.value = false
    }
  }

  async function evaluateSlas() {
    loading.value = true
    try {
      const result = await $fetch<{ evaluatedCount: number, newlyBreachedCount: number, breachedTrackingNumbers: string[] }>(
        '/api/deliveries/evaluate-slas',
        { method: 'POST' },
      )
      await refresh()
      toast.add({
        title: 'SLA Evaluation Complete',
        description: result.newlyBreachedCount > 0
          ? `${result.newlyBreachedCount} shipment(s) breached SLA: ${result.breachedTrackingNumbers.join(', ')}`
          : `Evaluated ${result.evaluatedCount} active shipment(s); no new SLA breaches.`,
        color: result.newlyBreachedCount > 0 ? 'error' : 'success',
        icon: result.newlyBreachedCount > 0 ? 'i-lucide-alert-triangle' : 'i-lucide-shield-check',
      })
      return result
    }
    catch (err: unknown) {
      const msg = (err as { data?: { statusMessage?: string }, message?: string })?.data?.statusMessage
        ?? (err as Error)?.message
        ?? 'SLA evaluation failed'
      toast.add({ title: 'SLA Evaluation Failed', description: msg, color: 'error' })
      return null
    }
    finally {
      loading.value = false
    }
  }

  function open() {
    isOpen.value = true
    refresh()
  }

  return {
    isOpen,
    snapshot,
    loading,
    refresh,
    open,
    advanceClock,
    resetClock,
    updateFaults,
    evaluateSlas,
  }
}
