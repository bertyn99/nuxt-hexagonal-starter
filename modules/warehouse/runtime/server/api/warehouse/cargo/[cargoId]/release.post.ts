import { useLogger } from 'evlog'
import { defineEventHandler } from 'h3'
import { resolveExecutionContext } from '../../../../../../../hexagonal-kernel/runtime/server/utils/actor-context'
import {
  mapDomainErrorToHttp,
  requireRouterParam,
} from '../../../../../../../hexagonal-kernel/runtime/server/utils/http-error-mapper'
import { useWarehouseModule } from '../../../../utils/warehouse-container'

export default defineEventHandler(async event => {
  const log = useLogger(event)
  try {
    const ctx = await resolveExecutionContext(event)
    const cargoId = requireRouterParam(event, 'cargoId')
    log.set({
      actor: { id: ctx.actor.id, roles: [...ctx.actor.roles] },
      cargo: { action: 'release', cargoId },
    })

    const warehouse = await useWarehouseModule()
    const result = await warehouse.releaseCargoFromBin.execute({ cargoId }, ctx)

    log.set({
      cargo: {
        releasedCargoId: result.releasedCargoId,
        binCode: result.bin.code,
      },
    })
    log.audit({
      action: 'warehouse.cargo.release',
      actor: { type: 'user', id: ctx.actor.id },
      target: { type: 'cargo', id: result.releasedCargoId },
      outcome: 'success',
    })
    return result
  } catch (error: unknown) {
    mapDomainErrorToHttp(error, event)
  }
})
