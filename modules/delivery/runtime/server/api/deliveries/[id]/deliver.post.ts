import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { mapDomainErrorToHttp } from '../../../../../../hexagonal-kernel/runtime/server/utils/http-error-mapper'
import { markDeliveredRequestSchema } from '../../../../../shared/schemas/delivery.schema'
import { useDeliveryModule } from '../../../utils/delivery-container'

export default defineEventHandler(async (event) => {
  try {
    const shipmentId = getRouterParam(event, 'id')
    if (!shipmentId) {
      throw createError({ statusCode: 400, statusMessage: 'Missing shipment id' })
    }
    const raw = await readBody(event).catch(() => undefined)
    const parsed = markDeliveredRequestSchema.safeParse(raw)
    const delivery = await useDeliveryModule()
    return await delivery.markDelivered.execute({
      shipmentId,
      recipientNote: parsed.success ? parsed.data?.recipientNote : undefined,
    })
  }
  catch (error: unknown) {
    mapDomainErrorToHttp(error)
  }
})
