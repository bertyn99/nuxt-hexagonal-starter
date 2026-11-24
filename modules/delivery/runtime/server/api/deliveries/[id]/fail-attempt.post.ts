import { useLogger } from 'evlog'
import { defineEventHandler, readBody } from 'h3'
import {
  mapDomainErrorToHttp,
  requireRouterParam,
} from '../../../../../../hexagonal-kernel/runtime/server/utils/http-error-mapper'
import { recordAttemptFailureRequestSchema } from '../../../../../shared/schemas/delivery.schema'
import { useDeliveryModule } from '../../../utils/delivery-container'

export default defineEventHandler(async event => {
  const log = useLogger(event)
  try {
    const shipmentId = requireRouterParam(event, 'id', 'shipment id')
    const raw = await readBody(event).catch(() => ({}))
    const parsed = recordAttemptFailureRequestSchema.safeParse(raw ?? {})
    const reason = parsed.success ? parsed.data.reason : 'Recipient unavailable at dock'

    log.set({ shipment: { action: 'fail_attempt', id: shipmentId, reason } })

    const delivery = await useDeliveryModule()
    const result = await delivery.recordAttemptFailure.execute({ shipmentId, reason })

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
