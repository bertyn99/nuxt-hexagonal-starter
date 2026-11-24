import { useLogger } from 'evlog'
import { defineEventHandler, readBody } from 'h3'
import {
  mapDomainErrorToHttp,
  requireRouterParam,
} from '../../../../../../hexagonal-kernel/runtime/server/utils/http-error-mapper'
import { markDeliveredRequestSchema } from '../../../../../shared/schemas/delivery.schema'
import { useDeliveryModule } from '../../../utils/delivery-container'

export default defineEventHandler(async event => {
  const log = useLogger(event)
  try {
    const shipmentId = requireRouterParam(event, 'id', 'shipment id')
    const raw = await readBody(event).catch(() => undefined)
    const parsed = markDeliveredRequestSchema.safeParse(raw)
    const recipientNote = parsed.success ? parsed.data?.recipientNote : undefined

    log.set({ shipment: { action: 'mark_delivered', id: shipmentId } })

    const delivery = await useDeliveryModule()
    const delivered = await delivery.markDelivered.execute({
      shipmentId,
      recipientNote,
    })

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
