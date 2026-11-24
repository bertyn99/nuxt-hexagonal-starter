import { useLogger } from 'evlog'
import { defineEventHandler, setResponseStatus } from 'h3'
import {
  mapDomainErrorToHttp,
  parseBodyWithSchema,
} from '../../../../../hexagonal-kernel/runtime/server/utils/http-error-mapper'
import { receiveCargoRequestSchema } from '../../../../shared/schemas/warehouse.schema'
import { useWarehouseModule } from '../../utils/warehouse-container'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    const payload = await parseBodyWithSchema(event, receiveCargoRequestSchema)
    log.set({
      cargo: {
        binId: payload.binId,
        kind: payload.kind,
        sku: payload.sku,
      },
    })

    const warehouse = await useWarehouseModule()
    const result = await warehouse.receiveAndStoreCargo.execute(payload)

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
  }
  catch (error: unknown) {
    mapDomainErrorToHttp(error, event)
  }
})
