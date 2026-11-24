import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { mapDomainErrorToHttp } from '../../../../../../hexagonal-kernel/runtime/server/utils/http-error-mapper'
import { advanceTransitRequestSchema } from '../../../../../shared/schemas/delivery.schema'
import { useDeliveryModule } from '../../../utils/delivery-container'

export default defineEventHandler(async (event) => {
  try {
    const shipmentId = getRouterParam(event, 'id')
    if (!shipmentId) {
      throw createError({ statusCode: 400, statusMessage: 'Missing shipment id' })
    }
    const raw = await readBody(event).catch(() => undefined)
    const parsed = advanceTransitRequestSchema.safeParse(raw)
    const delivery = await useDeliveryModule()
    return await delivery.advanceTransit.execute({
      shipmentId,
      locationNote: parsed.success ? parsed.data?.locationNote : undefined,
    })
  }
  catch (error: unknown) {
    mapDomainErrorToHttp(error)
  }
})
