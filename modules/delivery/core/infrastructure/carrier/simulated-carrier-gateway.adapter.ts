import type { CarrierFaultStateDto } from '../../../../hexagonal-kernel/shared/types/inspector'
import type {
  CarrierDispatchReceipt,
  CarrierDispatchRequest,
  CarrierGatewayPort,
} from '../../application/ports/outbound/carrier-gateway.port'
import { CarrierGatewayUnavailableError } from '../../domain/errors/delivery.errors'

let refSeq = 500

export class SimulatedCarrierGatewayAdapter implements CarrierGatewayPort {
  readonly adapterName = 'SimulatedCarrierGatewayAdapter'

  constructor(private readonly faultState: CarrierFaultStateDto = { outageEnabled: false, extraDelayHours: 0 }) {}

  async dispatchShipment(request: CarrierDispatchRequest): Promise<CarrierDispatchReceipt> {
    if (this.faultState.outageEnabled) {
      throw new CarrierGatewayUnavailableError(
        this.adapterName,
        'Simulated carrier API outage is active in Architecture Inspector.',
      )
    }

    refSeq += 1
    const prefix = request.carrierMode === 'EXPRESS_AIR'
      ? 'AIR'
      : request.carrierMode === 'COLD_CHAIN_COURIER'
        ? 'CRYO'
        : 'GRD'

    return {
      carrierReference: `${prefix}-${refSeq.toString().padStart(5, '0')}`,
      adapterName: this.adapterName,
      extraDelayHours: this.faultState.extraDelayHours,
    }
  }
}
