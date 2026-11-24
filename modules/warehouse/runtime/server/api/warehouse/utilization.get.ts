import { defineEventHandler } from 'h3'
import { mapDomainErrorToHttp } from '../../../../../hexagonal-kernel/runtime/server/utils/http-error-mapper'
import { useWarehouseModule } from '../../utils/warehouse-container'

export default defineEventHandler(async () => {
  try {
    const warehouse = await useWarehouseModule()
    return await warehouse.getUtilization.execute()
  }
  catch (error: unknown) {
    mapDomainErrorToHttp(error)
  }
})
