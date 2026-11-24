<script setup lang="ts">
import type { VirtualClockDto } from '../../../shared/types/inspector'

defineProps<{
  clock: VirtualClockDto
  loading?: boolean
}>()

const emit = defineEmits<{
  advance: [hours: number]
  reset: []
  evaluateSlas: []
}>()
</script>

<template>
  <UCard :ui="{ body: 'space-y-3 p-4' }">
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-clock" class="size-4 text-primary" />
        <span class="text-sm font-semibold">Virtual Clock (ClockPort)</span>
      </div>
      <UBadge
        :color="clock.offsetHours > 0 ? 'warning' : 'neutral'"
        variant="subtle"
        size="sm"
      >
        {{ clock.offsetHours > 0 ? `+${clock.offsetHours}h offset` : 'Live time' }}
      </UBadge>
    </div>

    <div class="rounded-md bg-elevated px-3 py-2 font-mono text-xs text-highlighted">
      {{ new Date(clock.currentTimeIso).toLocaleString() }}
      <span class="ml-1 text-muted">({{ clock.mode }})</span>
    </div>

    <div v-if="clock.controllable" class="flex flex-wrap gap-2">
      <UButton
        size="xs"
        color="neutral"
        variant="outline"
        icon="i-lucide-fast-forward"
        :loading="loading"
        @click="emit('advance', 2)"
      >
        +2h
      </UButton>
      <UButton
        size="xs"
        color="neutral"
        variant="outline"
        icon="i-lucide-fast-forward"
        :loading="loading"
        @click="emit('advance', 12)"
      >
        +12h
      </UButton>
      <UButton
        size="xs"
        color="neutral"
        variant="outline"
        icon="i-lucide-fast-forward"
        :loading="loading"
        @click="emit('advance', 24)"
      >
        +1d
      </UButton>
      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-rotate-ccw"
        :loading="loading"
        @click="emit('reset')"
      >
        Reset
      </UButton>
    </div>

    <USeparator />

    <div class="flex items-center justify-between gap-2">
      <p class="text-xs text-muted">
        Trigger deterministic SLA evaluation against current ClockPort timestamp.
      </p>
      <UButton
        size="xs"
        color="primary"
        variant="soft"
        icon="i-lucide-radar"
        :loading="loading"
        @click="emit('evaluateSlas')"
      >
        Evaluate SLAs
      </UButton>
    </div>
  </UCard>
</template>
