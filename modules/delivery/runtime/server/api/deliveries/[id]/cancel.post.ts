import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { mapDomainErrorToHttp } from '../../../../../../hexagonal-kernel/runtime/server/utils/http-error-mapper'
import { cancelShipmentRequestSchema } from '../../../../../shared/schemas/delivery.schema'
import { useDeliveryModule } from '../../../utils/delivery-container'

export default defineEventHandler(async (event) => {
  try {
    const shipmentId = getRouterParam(event, 'id')
    if (!shipmentId) {
      throw createError({ statusCode: 400, statusMessage: 'Missing shipment id' })
    }
    const raw = await readBody(event).catch(() => undefined)
    const parsed = cancelShipmentRequestSchema.safeParse(raw)
    const delivery = await useDeliveryModule()
    return await delivery.cancelShipment.execute({
      shipmentId,
      reason: parsed.success ? parsed.data?.reason : undefined,
    })
  }
  catch (error: unknown) {
    mapDomainErrorToHttp(error)
  }
})
