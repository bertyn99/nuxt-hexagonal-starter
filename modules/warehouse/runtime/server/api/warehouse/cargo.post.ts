import { defineEventHandler, setResponseStatus } from 'h3'
import {
  mapDomainErrorToHttp,
  parseBodyWithSchema,
} from '../../../../../hexagonal-kernel/runtime/server/utils/http-error-mapper'
import { receiveCargoRequestSchema } from '../../../../shared/schemas/warehouse.schema'
import { useWarehouseModule } from '../../utils/warehouse-container'

export default defineEventHandler(async (event) => {
  try {
    const payload = await parseBodyWithSchema(event, receiveCargoRequestSchema)
    const warehouse = await useWarehouseModule()
    const result = await warehouse.receiveAndStoreCargo.execute(payload)
    setResponseStatus(event, 201)
    return result
  }
  catch (error: unknown) {
    mapDomainErrorToHttp(error)
  }
})
