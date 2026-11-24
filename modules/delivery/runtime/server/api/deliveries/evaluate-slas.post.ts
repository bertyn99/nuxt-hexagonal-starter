import { useLogger } from 'evlog'
import { defineEventHandler } from 'h3'
import { mapDomainErrorToHttp } from '../../../../../hexagonal-kernel/runtime/server/utils/http-error-mapper'
import { useDeliveryModule } from '../../utils/delivery-container'

export default defineEventHandler(async event => {
  const log = useLogger(event)
  try {
    log.set({ sla: { action: 'evaluate' } })

    const delivery = await useDeliveryModule()
    const result = await delivery.evaluateSlas.execute()

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
