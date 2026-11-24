import { defineEventHandler, getQuery } from 'h3'
import { mapDomainErrorToHttp } from '../../../../../hexagonal-kernel/runtime/server/utils/http-error-mapper'
import { carrierModeSchema, shipmentStateSchema } from '../../../../shared/schemas/delivery.schema'
import { useDeliveryModule } from '../../utils/delivery-container'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const parsedState = query.state ? shipmentStateSchema.safeParse(String(query.state)) : null
    const parsedCarrier = query.carrierMode ? carrierModeSchema.safeParse(String(query.carrierMode)) : null
    const slaBreachedOnly = query.slaBreached === 'true'

    const delivery = await useDeliveryModule()
    return await delivery.listShipments.execute({
      state: parsedState?.success ? parsedState.data : undefined,
      carrierMode: parsedCarrier?.success ? parsedCarrier.data : undefined,
      slaBreachedOnly: slaBreachedOnly || undefined,
    })
  }
  catch (error: unknown) {
    mapDomainErrorToHttp(error)
  }
})
