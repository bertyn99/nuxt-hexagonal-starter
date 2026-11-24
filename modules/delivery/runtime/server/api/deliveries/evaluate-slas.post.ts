import { defineEventHandler } from 'h3'
import { mapDomainErrorToHttp } from '../../../../../hexagonal-kernel/runtime/server/utils/http-error-mapper'
import { useDeliveryModule } from '../../utils/delivery-container'

export default defineEventHandler(async () => {
  try {
    const delivery = await useDeliveryModule()
    return await delivery.evaluateSlas.execute()
  }
  catch (error: unknown) {
    mapDomainErrorToHttp(error)
  }
})
