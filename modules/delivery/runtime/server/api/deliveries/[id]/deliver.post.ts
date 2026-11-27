import { useLogger } from 'evlog'
import { defineEventHandler, readBody } from 'h3'
import { resolveExecutionContext } from '../../../../../../hexagonal-kernel/runtime/server/utils/actor-context'
import {
  mapDomainErrorToHttp,
  requireRouterParam,
} from '../../../../../../hexagonal-kernel/runtime/server/utils/http-error-mapper'
import { markDeliveredRequestSchema } from '../../../../../shared/schemas/delivery.schema'
import { useDeliveryModule } from '../../../utils/delivery-container'

export default defineEventHandler(async event => {
  const log = useLogger(event)
  try {
    const ctx = await resolveExecutionContext(event)
    const shipmentId = requireRouterParam(event, 'id', 'shipment id')
    const raw = await readBody(event).catch(() => undefined)
    const parsed = markDeliveredRequestSchema.safeParse(raw)
    const recipientNote = parsed.success ? parsed.data?.recipientNote : undefined

    log.set({
      actor: { id: ctx.actor.id, roles: [...ctx.actor.roles] },
      shipment: { action: 'mark_delivered', id: shipmentId },
    })

    const delivery = await useDeliveryModule()
    const delivered = await delivery.markDelivered.execute(
      {
        shipmentId,
        recipientNote,
      },
      ctx,
    )

    log.set({
      shipment: {
        trackingNumber: delivered.trackingNumber,
        state: delivered.state,
        slaBreached: delivered.slaBreached,
      },
    })
    return delivered
  } catch (error: unknown) {
    mapDomainErrorToHttp(error, event)
  }
})
