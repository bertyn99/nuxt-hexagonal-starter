import { useLogger } from 'evlog'
import { defineEventHandler, getQuery } from 'h3'
import { mapDomainErrorToHttp } from '../../../../../hexagonal-kernel/runtime/server/utils/http-error-mapper'
import { storageZoneSchema } from '../../../../shared/schemas/warehouse.schema'
import { useWarehouseModule } from '../../utils/warehouse-container'

export default defineEventHandler(async event => {
  const log = useLogger(event)
  try {
    const query = getQuery(event)
    const parsedZone = query.zone ? storageZoneSchema.safeParse(String(query.zone)) : null
    const zone = parsedZone?.success ? parsedZone.data : undefined

    log.set({ warehouse: { action: 'list_bins', zone: zone ?? 'ALL' } })

    const warehouse = await useWarehouseModule()
    const bins = await warehouse.listBins.execute({ zone })

    log.set({ warehouse: { binCount: bins.length } })
    return bins
  } catch (error: unknown) {
    mapDomainErrorToHttp(error, event)
  }
})
