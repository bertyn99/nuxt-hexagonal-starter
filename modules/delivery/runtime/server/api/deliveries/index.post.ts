import { defineEventHandler, setResponseStatus } from 'h3'
import {
  mapDomainErrorToHttp,
  parseBodyWithSchema,
} from '../../../../../hexagonal-kernel/runtime/server/utils/http-error-mapper'
import { createShipmentRequestSchema } from '../../../../shared/schemas/delivery.schema'
import { useDeliveryModule } from '../../utils/delivery-container'

export default defineEventHandler(async (event) => {
  try {
    const payload = await parseBodyWithSchema(event, createShipmentRequestSchema)
    const delivery = await useDeliveryModule()
    const created = await delivery.createShipmentFromWarehouse.execute(payload)
    setResponseStatus(event, 201)
    return created
  }
  catch (error: unknown) {
    mapDomainErrorToHttp(error)
  }
})
