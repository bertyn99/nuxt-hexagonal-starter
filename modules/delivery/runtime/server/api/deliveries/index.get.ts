import { useLogger } from 'evlog'
import { defineEventHandler, getQuery } from 'h3'
import { mapDomainErrorToHttp } from '../../../../../hexagonal-kernel/runtime/server/utils/http-error-mapper'
import { carrierModeSchema, shipmentStateSchema } from '../../../../shared/schemas/delivery.schema'
import { useDeliveryModule } from '../../utils/delivery-container'

export default defineEventHandler(async event => {
  const log = useLogger(event)
  try {
    const query = getQuery(event)
    const parsedState = query.state ? shipmentStateSchema.safeParse(String(query.state)) : null
    const parsedCarrier = query.carrierMode
      ? carrierModeSchema.safeParse(String(query.carrierMode))
      : null
    const slaBreachedOnly = query.slaBreached === 'true'

    const filters = {
      state: parsedState?.success ? parsedState.data : undefined,
      carrierMode: parsedCarrier?.success ? parsedCarrier.data : undefined,
      slaBreachedOnly: slaBreachedOnly || undefined,
    }
    log.set({ delivery: { action: 'list_shipments', filters } })

    const delivery = await useDeliveryModule()
    const shipments = await delivery.listShipments.execute(filters)

    log.set({ delivery: { shipmentCount: shipments.length } })
    return shipments
  } catch (error: unknown) {
    mapDomainErrorToHttp(error, event)
  }
})
