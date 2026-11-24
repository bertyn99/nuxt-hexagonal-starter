import { DomainError } from '../../../../hexagonal-kernel/core/domain/domain-error'
import type { DomainErrorStatusHint } from '../../../../hexagonal-kernel/core/domain/domain-error'

export class InvalidStateTransitionError extends DomainError {
  readonly code = 'INVALID_STATE_TRANSITION'
  readonly statusHint: DomainErrorStatusHint = 'conflict'

  constructor(currentState: string, attemptedAction: string, trackingNumber?: string) {
    super(
      trackingNumber
        ? `Cannot "${attemptedAction}" shipment ${trackingNumber} while in state "${currentState}".`
        : `Cannot "${attemptedAction}" while shipment is in state "${currentState}".`,
      { currentState, attemptedAction, trackingNumber },
    )
  }
}

export class CannotCancelDispatchedShipmentError extends DomainError {
  readonly code = 'CANNOT_CANCEL_DISPATCHED_SHIPMENT'
  readonly statusHint: DomainErrorStatusHint = 'conflict'

  constructor(trackingNumber: string, currentState: string) {
    super(
      `Shipment ${trackingNumber} cannot be cancelled because it is already "${currentState}". Cancellation is only permitted in PendingDispatch.`,
      { trackingNumber, currentState },
    )
  }
}

export class ShipmentNotFoundError extends DomainError {
  readonly code = 'SHIPMENT_NOT_FOUND'
  readonly statusHint: DomainErrorStatusHint = 'not_found'

  constructor(shipmentId: string) {
    super(`Shipment "${shipmentId}" was not found.`, { shipmentId })
  }
}

export class CarrierHandlingNotSupportedError extends DomainError {
  readonly code = 'CARRIER_HANDLING_NOT_SUPPORTED'
  readonly statusHint: DomainErrorStatusHint = 'conflict'

  constructor(carrierMode: string, handlingClass: string) {
    super(
      `Carrier strategy "${carrierMode}" cannot transport cargo with handling class "${handlingClass}".`,
      { carrierMode, handlingClass },
    )
  }
}

export class CarrierGatewayUnavailableError extends DomainError {
  readonly code = 'CARRIER_GATEWAY_UNAVAILABLE'
  readonly statusHint: DomainErrorStatusHint = 'unavailable'

  constructor(carrierName: string, reason: string) {
    super(`Carrier gateway "${carrierName}" is unavailable: ${reason}`, { carrierName, reason })
  }
}
