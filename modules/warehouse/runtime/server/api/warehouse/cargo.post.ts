import { useLogger } from 'evlog'
import { defineEventHandler, setResponseStatus } from 'h3'
import { resolveExecutionContext } from '../../../../../hexagonal-kernel/runtime/server/utils/actor-context'
import {
  mapDomainErrorToHttp,
  parseBodyWithSchema,
} from '../../../../../hexagonal-kernel/runtime/server/utils/http-error-mapper'
import { receiveCargoRequestSchema } from '../../../../shared/schemas/warehouse.schema'
import { useWarehouseModule } from '../../utils/warehouse-container'

export default defineEventHandler(async event => {
  const log = useLogger(event)
  try {
    const ctx = await resolveExecutionContext(event)
    const payload = await parseBodyWithSchema(event, receiveCargoRequestSchema)
    log.set({
      actor: { id: ctx.actor.id, roles: [...ctx.actor.roles] },
      cargo: {
        binId: payload.binId,
        kind: payload.kind,
        sku: payload.sku,
      },
    })

    const warehouse = await useWarehouseModule()
    const result = await warehouse.receiveAndStoreCargo.execute(payload, ctx)

    log.set({
      cargo: {
        storedCargoId: result.storedCargoId,
        binCode: result.bin.code,
        binZone: result.bin.zone,
        binUtilizationPercent: result.bin.utilizationPercent,
      },
    })
    setResponseStatus(event, 201)
    return result
  } catch (error: unknown) {
    mapDomainErrorToHttp(error, event)
  }
})
