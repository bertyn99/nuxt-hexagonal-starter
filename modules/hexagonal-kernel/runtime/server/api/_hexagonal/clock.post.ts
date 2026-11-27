import { createError, useLogger } from 'evlog'
import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { requireActorFromEvent } from '../../utils/actor-context'
import { hasAnyRole } from '../../../../core/domain/actor'
import { ForbiddenError } from '../../../../core/domain/domain-error'
import { assertInspectorEnabled, useHexagonalKernel } from '../../utils/hexagonal-kernel'
import { mapDomainErrorToHttp, parseBodyWithSchema } from '../../utils/http-error-mapper'

const clockActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('advance'),
    hours: z.number().positive().max(720),
  }),
  z.object({
    action: z.literal('reset'),
  }),
])

export default defineEventHandler(async event => {
  const log = useLogger(event)
  try {
    const kernel = useHexagonalKernel()
    assertInspectorEnabled(kernel)
    const actor = await requireActorFromEvent(event)
    if (!hasAnyRole(actor, ['admin'])) {
      throw new ForbiddenError('Only admin role can control the virtual clock', {
        actorId: actor.id,
        actorRoles: [...actor.roles],
        required: 'admin',
      })
    }
    if (!kernel.controllableClock) {
      throw createError({
        code: 'CLOCK_NOT_CONTROLLABLE',
        message: 'Virtual clock is not active',
        status: 400,
        why: `Active clock adapter is "${kernel.clock.mode}" instead of "virtual"`,
        fix: 'Set hexagonal.clock = "virtual" in nuxt.config.ts to control simulated time',
        data: { code: 'CLOCK_NOT_CONTROLLABLE' },
      })
    }

    const body = await parseBodyWithSchema(event, clockActionSchema)
    const offsetBefore = Number(
      (kernel.controllableClock.getOffsetMs() / (60 * 60 * 1000)).toFixed(2),
    )
    if (body.action === 'advance') {
      kernel.controllableClock.advanceByHours(body.hours)
      log.set({ clock: { action: 'advance', hours: body.hours } })
    } else {
      kernel.controllableClock.reset()
      log.set({ clock: { action: 'reset' } })
    }

    const snapshot = await kernel.getInspectorSnapshot()
    log.set({
      clock: {
        currentTimeIso: snapshot.clock.currentTimeIso,
        offsetHours: snapshot.clock.offsetHours,
      },
    })
    log.audit({
      action: `hexagonal.clock.${body.action}`,
      actor: { type: 'user', id: actor.id },
      target: { type: 'clock', id: 'virtual-clock' },
      outcome: 'success',
      changes: {
        before: { offsetHours: offsetBefore },
        after: { offsetHours: snapshot.clock.offsetHours },
      },
    })
    return snapshot
  } catch (error: unknown) {
    mapDomainErrorToHttp(error, event)
  }
})
