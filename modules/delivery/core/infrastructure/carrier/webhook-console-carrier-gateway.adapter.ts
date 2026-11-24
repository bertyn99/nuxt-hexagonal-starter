import type {
  CarrierDispatchReceipt,
  CarrierDispatchRequest,
  CarrierGatewayPort,
} from '../../application/ports/outbound/carrier-gateway.port'

let webhookSeq = 100

export class WebhookConsoleCarrierGatewayAdapter implements CarrierGatewayPort {
  readonly adapterName = 'WebhookConsoleCarrierGatewayAdapter'

  async dispatchShipment(request: CarrierDispatchRequest): Promise<CarrierDispatchReceipt> {
    webhookSeq += 1
    const carrierReference = `WHK-${webhookSeq.toString().padStart(5, '0')}`
    console.info(
      `[${this.adapterName}] Dispatched ${request.trackingNumber} (${request.carrierMode}) -> ${request.destination} [${carrierReference}]`,
    )
    return {
      carrierReference,
      adapterName: this.adapterName,
      extraDelayHours: 0,
    }
  }
}
