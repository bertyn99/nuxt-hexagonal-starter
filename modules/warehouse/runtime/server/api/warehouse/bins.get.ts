import { defineEventHandler, getQuery } from 'h3'
import { mapDomainErrorToHttp } from '../../../../../hexagonal-kernel/runtime/server/utils/http-error-mapper'
import { storageZoneSchema } from '../../../../shared/schemas/warehouse.schema'
import { useWarehouseModule } from '../../utils/warehouse-container'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const parsedZone = query.zone ? storageZoneSchema.safeParse(String(query.zone)) : null
    const warehouse = await useWarehouseModule()
    return await warehouse.listBins.execute({
      zone: parsedZone?.success ? parsedZone.data : undefined,
    })
  }
  catch (error: unknown) {
    mapDomainErrorToHttp(error)
  }
})
