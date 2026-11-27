import { useLogger } from 'evlog'
import { defineEventHandler, readBody } from 'h3'
import { resolveExecutionContext } from '../../../../../../hexagonal-kernel/runtime/server/utils/actor-context'
import {
  mapDomainErrorToHttp,
  requireRouterParam,
} from '../../../../../../hexagonal-kernel/runtime/server/utils/http-error-mapper'
import { cancelShipmentRequestSchema } from '../../../../../shared/schemas/delivery.schema'
import { useDeliveryModule } from '../../../utils/delivery-container'

export default defineEventHandler(async event => {
  const log = useLogger(event)
  try {
    const ctx = await resolveExecutionContext(event)
    const shipmentId = requireRouterParam(event, 'id', 'shipment id')
    const raw = await readBody(event).catch(() => undefined)
    const parsed = cancelShipmentRequestSchema.safeParse(raw)
    const reason = parsed.success ? parsed.data?.reason : undefined

    log.set({
      actor: { id: ctx.actor.id, roles: [...ctx.actor.roles] },
      shipment: { action: 'cancel', id: shipmentId, hasReason: Boolean(reason) },
    })

    const delivery = await useDeliveryModule()
    const cancelled = await delivery.cancelShipment.execute(
      {
        shipmentId,
        reason,
      },
      ctx,
    )

    log.set({
      shipment: {
        trackingNumber: cancelled.trackingNumber,
        state: cancelled.state,
      },
    })
    log.audit({
      action: 'delivery.shipment.cancel',
      actor: { type: 'user', id: ctx.actor.id },
      target: { type: 'shipment', id: cancelled.id },
      outcome: 'success',
      reason,
    })
    return cancelled
  } catch (error: unknown) {
    mapDomainErrorToHttp(error, event)
  }
})
