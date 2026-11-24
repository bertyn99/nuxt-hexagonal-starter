import type { InspectorSnapshotDto } from '../../../shared/types/inspector'

function formatInspectorError(err: unknown, fallbackMessage: string) {
  const parsed = parseError(err)
  const details = [parsed.why ?? parsed.message ?? fallbackMessage, parsed.fix ? `Fix: ${parsed.fix}` : null]
    .filter(Boolean)
    .join(' — ')
  return { parsed, details }
}

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
    catch (err: unknown) {
      const { parsed, details } = formatInspectorError(err, 'Failed to load inspector snapshot')
      log.error({ action: 'inspector_refresh_failed', status: parsed.status, message: parsed.message })
      toast.add({ title: 'Inspector refresh failed', description: details, color: 'error' })
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
      const { parsed, details } = formatInspectorError(err, 'Failed to advance clock')
      log.error({ action: 'inspector_advance_clock_failed', hours, status: parsed.status, code: parsed.code })
      toast.add({ title: 'Clock error', description: details, color: 'error' })
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
    catch (err: unknown) {
      const { parsed, details } = formatInspectorError(err, 'Failed to reset clock')
      log.error({ action: 'inspector_reset_clock_failed', status: parsed.status, code: parsed.code })
      toast.add({ title: 'Clock reset failed', description: details, color: 'error' })
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
    catch (err: unknown) {
      const { parsed, details } = formatInspectorError(err, 'Failed to update carrier faults')
      log.error({ action: 'inspector_update_faults_failed', status: parsed.status, code: parsed.code })
      toast.add({ title: 'Fault update failed', description: details, color: 'error' })
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
      const { parsed, details } = formatInspectorError(err, 'SLA evaluation failed')
      log.error({ action: 'inspector_evaluate_slas_failed', status: parsed.status, code: parsed.code })
      toast.add({ title: 'SLA Evaluation Failed', description: details, color: 'error' })
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
