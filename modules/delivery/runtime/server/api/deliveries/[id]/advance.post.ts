import { useLogger } from 'evlog'
import { defineEventHandler, readBody } from 'h3'
import { resolveExecutionContext } from '../../../../../../hexagonal-kernel/runtime/server/utils/actor-context'
import {
  mapDomainErrorToHttp,
  requireRouterParam,
} from '../../../../../../hexagonal-kernel/runtime/server/utils/http-error-mapper'
import { advanceTransitRequestSchema } from '../../../../../shared/schemas/delivery.schema'
import { useDeliveryModule } from '../../../utils/delivery-container'

export default defineEventHandler(async event => {
  const log = useLogger(event)
  try {
    const ctx = await resolveExecutionContext(event)
    const shipmentId = requireRouterParam(event, 'id', 'shipment id')
    const raw = await readBody(event).catch(() => undefined)
    const parsed = advanceTransitRequestSchema.safeParse(raw)
    const locationNote = parsed.success ? parsed.data?.locationNote : undefined

    log.set({
      actor: { id: ctx.actor.id, roles: [...ctx.actor.roles] },
      shipment: { action: 'advance_transit', id: shipmentId },
    })

    const delivery = await useDeliveryModule()
    const updated = await delivery.advanceTransit.execute(
      {
        shipmentId,
        locationNote,
      },
      ctx,
    )

    log.set({
      shipment: {
        trackingNumber: updated.trackingNumber,
        state: updated.state,
      },
    })
    return updated
  } catch (error: unknown) {
    mapDomainErrorToHttp(error, event)
  }
})
