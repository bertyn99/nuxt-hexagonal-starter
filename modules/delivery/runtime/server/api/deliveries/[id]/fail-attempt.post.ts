import { useLogger } from 'evlog'
import { defineEventHandler, readBody } from 'h3'
import { resolveExecutionContext } from '../../../../../../hexagonal-kernel/runtime/server/utils/actor-context'
import {
  mapDomainErrorToHttp,
  requireRouterParam,
} from '../../../../../../hexagonal-kernel/runtime/server/utils/http-error-mapper'
import { recordAttemptFailureRequestSchema } from '../../../../../shared/schemas/delivery.schema'
import { useDeliveryModule } from '../../../utils/delivery-container'

export default defineEventHandler(async event => {
  const log = useLogger(event)
  try {
    const ctx = await resolveExecutionContext(event)
    const shipmentId = requireRouterParam(event, 'id', 'shipment id')
    const raw = await readBody(event).catch(() => ({}))
    const parsed = recordAttemptFailureRequestSchema.safeParse(raw ?? {})
    const reason = parsed.success ? parsed.data.reason : 'Recipient unavailable at dock'

    log.set({
      actor: { id: ctx.actor.id, roles: [...ctx.actor.roles] },
      shipment: { action: 'fail_attempt', id: shipmentId, reason },
    })

    const delivery = await useDeliveryModule()
    const result = await delivery.recordAttemptFailure.execute({ shipmentId, reason }, ctx)

    log.set({
      shipment: {
        trackingNumber: result.shipment.trackingNumber,
        state: result.shipment.state,
        attemptCount: result.shipment.attemptCount,
        resolutionAction: result.resolution.action,
      },
    })
    return result
  } catch (error: unknown) {
    mapDomainErrorToHttp(error, event)
  }
})
