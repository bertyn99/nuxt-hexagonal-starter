import { useLogger } from 'evlog'
import { defineEventHandler, readBody } from 'h3'
import {
  mapDomainErrorToHttp,
  requireRouterParam,
} from '../../../../../../hexagonal-kernel/runtime/server/utils/http-error-mapper'
import { advanceTransitRequestSchema } from '../../../../../shared/schemas/delivery.schema'
import { useDeliveryModule } from '../../../utils/delivery-container'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    const shipmentId = requireRouterParam(event, 'id', 'shipment id')
    const raw = await readBody(event).catch(() => undefined)
    const parsed = advanceTransitRequestSchema.safeParse(raw)
    const locationNote = parsed.success ? parsed.data?.locationNote : undefined

    log.set({ shipment: { action: 'advance_transit', id: shipmentId } })

    const delivery = await useDeliveryModule()
    const updated = await delivery.advanceTransit.execute({
      shipmentId,
      locationNote,
    })

    log.set({
      shipment: {
        trackingNumber: updated.trackingNumber,
        state: updated.state,
      },
    })
    return updated
  }
  catch (error: unknown) {
    mapDomainErrorToHttp(error, event)
  }
})
