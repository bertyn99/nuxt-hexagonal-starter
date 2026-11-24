import type { DrainContext } from 'evlog'
import { createRequestSizeEnricher, createUserAgentEnricher } from 'evlog/enrichers'
import { createFsDrain } from 'evlog/fs'
import { createDrainPipeline } from 'evlog/pipeline'
import { defineNitroPlugin } from 'nitropack/runtime'
import { useHexagonalKernel } from '../utils/hexagonal-kernel'

export default defineNitroPlugin(nitroApp => {
  const enrichers = [createUserAgentEnricher(), createRequestSizeEnricher()]

  nitroApp.hooks.hook('evlog:enrich', ctx => {
    for (const enricher of enrichers) {
      enricher(ctx)
    }

    const kernel = useHexagonalKernel()
    ctx.event.hexagonal = {
      persistence: kernel.config.persistence,
      carrier: kernel.config.carrier,
      clockMode: kernel.clock.mode,
      faultOutageEnabled: kernel.faultState.outageEnabled,
      faultExtraDelayHours: kernel.faultState.extraDelayHours,
    }
  })

  nitroApp.hooks.hook('evlog:emit:keep', ctx => {
    const kernel = useHexagonalKernel()
    if (kernel.faultState.outageEnabled || kernel.faultState.extraDelayHours > 0) {
      ctx.shouldKeep = true
    }
  })

  // Persist wide events to local NDJSON (.evlog/logs/) outside test runs
  if (!process.env.VITEST) {
    const fsDrain = createFsDrain({
      dir: '.evlog/logs',
      maxFiles: 7,
    })

    const pipeline = createDrainPipeline<DrainContext>({
      batch: {
        size: 50,
        intervalMs: 5000,
      },
      retry: {
        maxAttempts: 3,
        backoff: 'exponential',
        initialDelayMs: 1000,
        maxDelayMs: 30000,
      },
      maxBufferSize: 1000,
      onDropped: (events, error) => {
        process.stderr.write(
          `[evlog] Dropped ${events.length} event(s): ${error?.message ?? 'buffer overflow'}\n`,
        )
      },
    })

    const drain = pipeline(fsDrain)

    nitroApp.hooks.hook('evlog:drain', drain)
    nitroApp.hooks.hook('close', () => drain.flush())
  }
})
