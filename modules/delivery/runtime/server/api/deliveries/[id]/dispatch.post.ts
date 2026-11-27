import { useLogger } from 'evlog'
import { defineEventHandler } from 'h3'
import { resolveExecutionContext } from '../../../../../../hexagonal-kernel/runtime/server/utils/actor-context'
import {
  mapDomainErrorToHttp,
  requireRouterParam,
} from '../../../../../../hexagonal-kernel/runtime/server/utils/http-error-mapper'
import { useDeliveryModule } from '../../../utils/delivery-container'

export default defineEventHandler(async event => {
  const log = useLogger(event)
  try {
    const ctx = await resolveExecutionContext(event)
    const shipmentId = requireRouterParam(event, 'id', 'shipment id')
    log.set({
      actor: { id: ctx.actor.id, roles: [...ctx.actor.roles] },
      shipment: { action: 'dispatch', id: shipmentId },
    })

    const delivery = await useDeliveryModule()
    const dispatched = await delivery.dispatchShipment.execute({ shipmentId }, ctx)

    log.set({
      shipment: {
        trackingNumber: dispatched.trackingNumber,
        state: dispatched.state,
        carrierMode: dispatched.carrierMode,
        carrierReference: dispatched.carrierReference,
      },
    })
    return dispatched
  } catch (error: unknown) {
    mapDomainErrorToHttp(error, event)
  }
})
