import { useLogger } from 'evlog'
import { defineEventHandler } from 'h3'
import { mapDomainErrorToHttp } from '../../../../../hexagonal-kernel/runtime/server/utils/http-error-mapper'
import { useDeliveryModule } from '../../utils/delivery-container'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    log.set({ delivery: { action: 'list_available_cargo' } })

    const delivery = await useDeliveryModule()
    const cargo = await delivery.warehouseStockPort.listAvailableCargo()

    log.set({ delivery: { availableCargoCount: cargo.length } })
    return cargo
  }
  catch (error: unknown) {
    mapDomainErrorToHttp(error, event)
  }
})
