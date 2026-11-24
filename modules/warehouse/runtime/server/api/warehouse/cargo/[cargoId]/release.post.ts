import { createError, defineEventHandler, getRouterParam } from 'h3'
import { mapDomainErrorToHttp } from '../../../../../../../hexagonal-kernel/runtime/server/utils/http-error-mapper'
import { useWarehouseModule } from '../../../../utils/warehouse-container'

export default defineEventHandler(async (event) => {
  try {
    const cargoId = getRouterParam(event, 'cargoId')
    if (!cargoId) {
      throw createError({ statusCode: 400, statusMessage: 'Missing cargoId parameter' })
    }
    const warehouse = await useWarehouseModule()
    return await warehouse.releaseCargoFromBin.execute({ cargoId })
  }
  catch (error: unknown) {
    mapDomainErrorToHttp(error)
  }
})
