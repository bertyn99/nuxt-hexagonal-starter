import { useLogger } from 'evlog'
import { defineEventHandler } from 'h3'
import { useHexagonalKernel } from '../../utils/hexagonal-kernel'
import { mapDomainErrorToHttp } from '../../utils/http-error-mapper'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    const kernel = useHexagonalKernel()
    const snapshot = await kernel.getInspectorSnapshot()
    log.set({
      inspector: {
        moduleCount: snapshot.modules.length,
        traceCount: snapshot.traces.length,
        recentEventCount: snapshot.recentEvents.length,
      },
    })
    return snapshot
  }
  catch (error: unknown) {
    mapDomainErrorToHttp(error, event)
  }
})
