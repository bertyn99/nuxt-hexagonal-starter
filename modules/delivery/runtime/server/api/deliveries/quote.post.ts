import { useLogger } from 'evlog'
import { defineEventHandler } from 'h3'
import {
  mapDomainErrorToHttp,
  parseBodyWithSchema,
} from '../../../../../hexagonal-kernel/runtime/server/utils/http-error-mapper'
import { quoteShipmentRequestSchema } from '../../../../shared/schemas/delivery.schema'
import { useDeliveryModule } from '../../utils/delivery-container'

export default defineEventHandler(async event => {
  const log = useLogger(event)
  try {
    const payload = await parseBodyWithSchema(event, quoteShipmentRequestSchema)
    log.set({
      quote: {
        carrierMode: payload.carrierMode,
        handlingClass: payload.handlingClass,
        weightKg: payload.weightKg,
        volumeM3: payload.volumeM3,
      },
    })

    const delivery = await useDeliveryModule()
    const quote = await delivery.quoteShipment.execute(payload)

    log.set({
      quote: {
        costCents: quote.costCents,
        estimatedHours: quote.estimatedHours,
      },
    })
    return quote
  } catch (error: unknown) {
    mapDomainErrorToHttp(error, event)
  }
})
