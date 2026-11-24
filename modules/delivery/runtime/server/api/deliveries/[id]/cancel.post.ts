import { useLogger } from 'evlog'
import { defineEventHandler, readBody } from 'h3'
import {
  mapDomainErrorToHttp,
  requireRouterParam,
} from '../../../../../../hexagonal-kernel/runtime/server/utils/http-error-mapper'
import { cancelShipmentRequestSchema } from '../../../../../shared/schemas/delivery.schema'
import { useDeliveryModule } from '../../../utils/delivery-container'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    const shipmentId = requireRouterParam(event, 'id', 'shipment id')
    const raw = await readBody(event).catch(() => undefined)
    const parsed = cancelShipmentRequestSchema.safeParse(raw)
    const reason = parsed.success ? parsed.data?.reason : undefined

    log.set({ shipment: { action: 'cancel', id: shipmentId, hasReason: Boolean(reason) } })

    const delivery = await useDeliveryModule()
    const cancelled = await delivery.cancelShipment.execute({
      shipmentId,
      reason,
    })

    log.set({
      shipment: {
        trackingNumber: cancelled.trackingNumber,
        state: cancelled.state,
      },
    })
    log.audit({
      action: 'delivery.shipment.cancel',
      actor: { type: 'system', id: 'operator' },
      target: { type: 'shipment', id: cancelled.id },
      outcome: 'success',
      reason,
    })
    return cancelled
  }
  catch (error: unknown) {
    mapDomainErrorToHttp(error, event)
  }
})
