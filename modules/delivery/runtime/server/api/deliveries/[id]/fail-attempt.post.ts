import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { mapDomainErrorToHttp } from '../../../../../../hexagonal-kernel/runtime/server/utils/http-error-mapper'
import { recordAttemptFailureRequestSchema } from '../../../../../shared/schemas/delivery.schema'
import { useDeliveryModule } from '../../../utils/delivery-container'

export default defineEventHandler(async (event) => {
  try {
    const shipmentId = getRouterParam(event, 'id')
    if (!shipmentId) {
      throw createError({ statusCode: 400, statusMessage: 'Missing shipment id' })
    }
    const raw = await readBody(event).catch(() => ({}))
    const parsed = recordAttemptFailureRequestSchema.safeParse(raw ?? {})
    const reason = parsed.success ? parsed.data.reason : 'Recipient unavailable at dock'

    const delivery = await useDeliveryModule()
    return await delivery.recordAttemptFailure.execute({ shipmentId, reason })
  }
  catch (error: unknown) {
    mapDomainErrorToHttp(error)
  }
})
