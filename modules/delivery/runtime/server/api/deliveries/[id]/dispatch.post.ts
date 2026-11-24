import { createError, defineEventHandler, getRouterParam } from 'h3'
import { mapDomainErrorToHttp } from '../../../../../../hexagonal-kernel/runtime/server/utils/http-error-mapper'
import { useDeliveryModule } from '../../../utils/delivery-container'

export default defineEventHandler(async (event) => {
  try {
    const shipmentId = getRouterParam(event, 'id')
    if (!shipmentId) {
      throw createError({ statusCode: 400, statusMessage: 'Missing shipment id' })
    }
    const delivery = await useDeliveryModule()
    return await delivery.dispatchShipment.execute({ shipmentId })
  }
  catch (error: unknown) {
    mapDomainErrorToHttp(error)
  }
})
