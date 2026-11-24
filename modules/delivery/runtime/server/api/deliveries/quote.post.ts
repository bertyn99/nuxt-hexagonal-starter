import { defineEventHandler } from 'h3'
import {
  mapDomainErrorToHttp,
  parseBodyWithSchema,
} from '../../../../../hexagonal-kernel/runtime/server/utils/http-error-mapper'
import { quoteShipmentRequestSchema } from '../../../../shared/schemas/delivery.schema'
import { useDeliveryModule } from '../../utils/delivery-container'

export default defineEventHandler(async (event) => {
  try {
    const payload = await parseBodyWithSchema(event, quoteShipmentRequestSchema)
    const delivery = await useDeliveryModule()
    return await delivery.quoteShipment.execute(payload)
  }
  catch (error: unknown) {
    mapDomainErrorToHttp(error)
  }
})
