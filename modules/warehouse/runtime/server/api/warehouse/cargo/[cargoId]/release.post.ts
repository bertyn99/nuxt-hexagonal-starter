import { useLogger } from 'evlog'
import { defineEventHandler } from 'h3'
import {
  mapDomainErrorToHttp,
  requireRouterParam,
} from '../../../../../../../hexagonal-kernel/runtime/server/utils/http-error-mapper'
import { useWarehouseModule } from '../../../../utils/warehouse-container'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    const cargoId = requireRouterParam(event, 'cargoId')
    log.set({ cargo: { action: 'release', cargoId } })

    const warehouse = await useWarehouseModule()
    const result = await warehouse.releaseCargoFromBin.execute({ cargoId })

    log.set({
      cargo: {
        releasedCargoId: result.releasedCargoId,
        binCode: result.bin.code,
      },
    })
    log.audit({
      action: 'warehouse.cargo.release',
      actor: { type: 'system', id: 'operator' },
      target: { type: 'cargo', id: result.releasedCargoId },
      outcome: 'success',
    })
    return result
  }
  catch (error: unknown) {
    mapDomainErrorToHttp(error, event)
  }
})
