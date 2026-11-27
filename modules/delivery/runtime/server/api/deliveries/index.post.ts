import { useLogger } from 'evlog'
import { defineEventHandler, setResponseStatus } from 'h3'
import { resolveExecutionContext } from '../../../../../hexagonal-kernel/runtime/server/utils/actor-context'
import {
  mapDomainErrorToHttp,
  parseBodyWithSchema,
} from '../../../../../hexagonal-kernel/runtime/server/utils/http-error-mapper'
import { createShipmentRequestSchema } from '../../../../shared/schemas/delivery.schema'
import { useDeliveryModule } from '../../utils/delivery-container'

export default defineEventHandler(async event => {
  const log = useLogger(event)
  try {
    const ctx = await resolveExecutionContext(event)
    const payload = await parseBodyWithSchema(event, createShipmentRequestSchema)
    log.set({
      actor: { id: ctx.actor.id, roles: [...ctx.actor.roles] },
      shipment: {
        action: 'create',
        cargoId: payload.cargoId,
        carrierMode: payload.carrierMode,
        destination: payload.destination,
      },
    })

    const delivery = await useDeliveryModule()
    const created = await delivery.createShipmentFromWarehouse.execute(payload, ctx)

    log.set({
      shipment: {
        id: created.id,
        trackingNumber: created.trackingNumber,
        originBinCode: created.originBinCode,
        state: created.state,
        quotedCostCents: created.quotedCostCents,
      },
    })
    setResponseStatus(event, 201)
    return created
  } catch (error: unknown) {
    mapDomainErrorToHttp(error, event)
  }
})
