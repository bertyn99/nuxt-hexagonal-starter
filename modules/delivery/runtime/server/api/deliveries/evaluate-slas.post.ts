import { useLogger } from 'evlog'
import { defineEventHandler } from 'h3'
import { resolveExecutionContext } from '../../../../../hexagonal-kernel/runtime/server/utils/actor-context'
import { mapDomainErrorToHttp } from '../../../../../hexagonal-kernel/runtime/server/utils/http-error-mapper'
import { useDeliveryModule } from '../../utils/delivery-container'

export default defineEventHandler(async event => {
  const log = useLogger(event)
  try {
    const ctx = await resolveExecutionContext(event)
    log.set({
      actor: { id: ctx.actor.id, roles: [...ctx.actor.roles] },
      sla: { action: 'evaluate' },
    })

    const delivery = await useDeliveryModule()
    const result = await delivery.evaluateSlas.execute(undefined, ctx)

    log.set({
      sla: {
        evaluatedCount: result.evaluatedCount,
        newlyBreachedCount: result.newlyBreachedCount,
        totalBreachedCount: result.totalBreachedCount,
      },
    })
    return result
  } catch (error: unknown) {
    mapDomainErrorToHttp(error, event)
  }
})
