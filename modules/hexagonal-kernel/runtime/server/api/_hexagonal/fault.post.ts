import { useLogger } from 'evlog'
import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { requireActorFromEvent } from '../../utils/actor-context'
import { hasAnyRole } from '../../../../core/domain/actor'
import { ForbiddenError } from '../../../../core/domain/domain-error'
import { assertInspectorEnabled, useHexagonalKernel } from '../../utils/hexagonal-kernel'
import { mapDomainErrorToHttp, parseBodyWithSchema } from '../../utils/http-error-mapper'

const faultUpdateSchema = z.object({
  outageEnabled: z.boolean().optional(),
  extraDelayHours: z.number().min(0).max(168).optional(),
})

export default defineEventHandler(async event => {
  const log = useLogger(event)
  try {
    const kernel = useHexagonalKernel()
    assertInspectorEnabled(kernel)
    const actor = await requireActorFromEvent(event)
    if (!hasAnyRole(actor, ['admin'])) {
      throw new ForbiddenError('Only admin role can inject carrier faults', {
        actorId: actor.id,
        actorRoles: [...actor.roles],
        required: 'admin',
      })
    }
    const body = await parseBodyWithSchema(event, faultUpdateSchema)
    const before = { ...kernel.faultState }

    if (typeof body.outageEnabled === 'boolean') {
      kernel.faultState.outageEnabled = body.outageEnabled
    }
    if (typeof body.extraDelayHours === 'number') {
      kernel.faultState.extraDelayHours = body.extraDelayHours
    }

    const snapshot = await kernel.getInspectorSnapshot()
    log.set({
      faults: {
        outageEnabled: snapshot.faults.outageEnabled,
        extraDelayHours: snapshot.faults.extraDelayHours,
      },
    })
    log.audit({
      action: 'hexagonal.fault.update',
      actor: { type: 'user', id: actor.id },
      target: { type: 'carrier-fault-state', id: kernel.config.carrier },
      outcome: 'success',
      changes: {
        before,
        after: { ...snapshot.faults },
      },
    })
    return snapshot
  } catch (error: unknown) {
    mapDomainErrorToHttp(error, event)
  }
})
