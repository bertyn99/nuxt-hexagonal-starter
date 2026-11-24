import { useLogger } from 'evlog'
import { defineEventHandler } from 'h3'
import { mapDomainErrorToHttp } from '../../../../../hexagonal-kernel/runtime/server/utils/http-error-mapper'
import { useWarehouseModule } from '../../utils/warehouse-container'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    log.set({ warehouse: { action: 'get_utilization' } })

    const warehouse = await useWarehouseModule()
    const utilization = await warehouse.getUtilization.execute()

    log.set({
      warehouse: {
        totalBins: utilization.totalBins,
        totalCargoUnits: utilization.totalCargoUnits,
        overallUtilizationPercent: utilization.overallUtilizationPercent,
      },
    })
    return utilization
  }
  catch (error: unknown) {
    mapDomainErrorToHttp(error, event)
  }
})
