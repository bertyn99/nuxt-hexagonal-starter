<script setup lang="ts">
import type { CallTraceDto } from '../../../shared/types/inspector'

defineProps<{
  traces: CallTraceDto[]
}>()

const layerColors: Record<string, 'primary' | 'info' | 'success' | 'warning' | 'neutral'> = {
  'driving-adapter': 'neutral',
  'application': 'info',
  'domain': 'primary',
  'driven-adapter': 'warning',
  'event-bus': 'success',
}

const layerLabels: Record<string, string> = {
  'driving-adapter': 'Driving Adapter',
  'application': 'Application',
  'domain': 'Pure Domain',
  'driven-adapter': 'Driven Adapter',
  'event-bus': 'Event Bus',
}
</script>

<template>
  <div class="space-y-3">
    <div v-if="traces.length === 0" class="rounded-lg border border-dashed border-default p-4 text-center text-xs text-muted">
      Trigger any Warehouse or Delivery action to capture a live Hexagonal call trace via <code>TracingUseCaseDecorator</code>.
    </div>

    <UCard
      v-for="trace in traces.slice(0, 6)"
      :key="trace.traceId"
      :ui="{ body: 'space-y-2.5 p-3' }"
    >
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <UBadge
            :color="trace.status === 'ok' ? 'success' : 'error'"
            variant="subtle"
            size="xs"
          >
            {{ trace.boundedContext }}
          </UBadge>
          <span class="truncate font-mono text-xs font-semibold text-highlighted">
            {{ trace.useCaseName }}
          </span>
        </div>
        <span class="shrink-0 font-mono text-[11px] text-muted">
          {{ trace.totalDurationMs }} ms
        </span>
      </div>

      <div class="space-y-1.5 border-l-2 border-default pl-3">
        <div
          v-for="(step, idx) in trace.steps"
          :key="idx"
          class="flex items-start justify-between gap-2 text-xs"
        >
          <div class="space-y-0.5 min-w-0">
            <div class="flex items-center gap-1.5 flex-wrap">
              <UBadge
                :color="step.status === 'error' ? 'error' : (layerColors[step.layer] ?? 'neutral')"
                variant="soft"
                size="xs"
              >
                {{ layerLabels[step.layer] ?? step.layer }}
              </UBadge>
              <span class="font-mono text-[11px] font-medium text-highlighted">{{ step.component }}</span>
            </div>
            <p class="text-[11px] text-muted leading-snug">
              {{ step.detail }}
            </p>
          </div>
          <span class="shrink-0 font-mono text-[10px] text-dimmed">
            {{ step.durationMs }}ms
          </span>
        </div>
      </div>

      <UAlert
        v-if="trace.status === 'error'"
        color="error"
        variant="subtle"
        :title="trace.errorCode ?? 'DOMAIN_ERROR'"
        :description="trace.errorMessage"
        class="text-xs"
      />
    </UCard>
  </div>
</template>
