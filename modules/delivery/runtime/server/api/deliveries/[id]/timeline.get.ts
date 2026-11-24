import { useLogger } from 'evlog'
import { defineEventHandler } from 'h3'
import {
  mapDomainErrorToHttp,
  requireRouterParam,
} from '../../../../../../hexagonal-kernel/runtime/server/utils/http-error-mapper'
import { useDeliveryModule } from '../../../utils/delivery-container'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    const shipmentId = requireRouterParam(event, 'id', 'shipment id')
    log.set({ shipment: { action: 'get_timeline', id: shipmentId } })

    const delivery = await useDeliveryModule()
    const timeline = await delivery.getTimeline.execute({ shipmentId })

    log.set({
      shipment: {
        trackingNumber: timeline.shipment.trackingNumber,
        state: timeline.shipment.state,
        eventCount: timeline.events.length,
      },
    })
    return timeline
  }
  catch (error: unknown) {
    mapDomainErrorToHttp(error, event)
  }
})
