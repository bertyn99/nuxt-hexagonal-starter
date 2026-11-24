import {
  CannotCancelDispatchedShipmentError,
  InvalidStateTransitionError,
} from '../errors/delivery.errors'

export const SHIPMENT_STATES = [
  'PendingDispatch',
  'Dispatched',
  'InTransit',
  'OutForDelivery',
  'DeliveryAttemptFailed',
  'Delivered',
  'ReturnedToWarehouse',
  'Cancelled',
] as const

export type ShipmentStateName = (typeof SHIPMENT_STATES)[number]

/**
 * State Pattern: each ShipmentState governs allowed transitions and throws typed DomainErrors
 * when an illegal transition is attempted.
 */
export interface ShipmentState {
  readonly name: ShipmentStateName
  readonly isTerminal: boolean
  dispatch(trackingNumber: string): ShipmentState
  advanceTransit(trackingNumber: string): ShipmentState
  markDelivered(trackingNumber: string): ShipmentState
  recordFailedAttempt(trackingNumber: string, shouldReturnToWarehouse: boolean): ShipmentState
  cancel(trackingNumber: string): ShipmentState
}

abstract class BaseShipmentState implements ShipmentState {
  abstract readonly name: ShipmentStateName
  readonly isTerminal: boolean = false

  dispatch(trackingNumber: string): ShipmentState {
    throw new InvalidStateTransitionError(this.name, 'dispatch', trackingNumber)
  }

  advanceTransit(trackingNumber: string): ShipmentState {
    throw new InvalidStateTransitionError(this.name, 'advanceTransit', trackingNumber)
  }

  markDelivered(trackingNumber: string): ShipmentState {
    throw new InvalidStateTransitionError(this.name, 'markDelivered', trackingNumber)
  }

  recordFailedAttempt(trackingNumber: string, _shouldReturnToWarehouse: boolean): ShipmentState {
    throw new InvalidStateTransitionError(this.name, 'recordFailedAttempt', trackingNumber)
  }

  cancel(trackingNumber: string): ShipmentState {
    throw new CannotCancelDispatchedShipmentError(trackingNumber, this.name)
  }
}

export class PendingDispatchState extends BaseShipmentState {
  readonly name: ShipmentStateName = 'PendingDispatch'

  override dispatch(): ShipmentState {
    return new DispatchedState()
  }

  override cancel(): ShipmentState {
    return new CancelledState()
  }
}

export class DispatchedState extends BaseShipmentState {
  readonly name: ShipmentStateName = 'Dispatched'

  override advanceTransit(): ShipmentState {
    return new InTransitState()
  }
}

export class InTransitState extends BaseShipmentState {
  readonly name: ShipmentStateName = 'InTransit'

  override advanceTransit(): ShipmentState {
    return new OutForDeliveryState()
  }
}

export class OutForDeliveryState extends BaseShipmentState {
  readonly name: ShipmentStateName = 'OutForDelivery'

  override markDelivered(): ShipmentState {
    return new DeliveredState()
  }

  override recordFailedAttempt(_trackingNumber: string, shouldReturnToWarehouse: boolean): ShipmentState {
    return shouldReturnToWarehouse
      ? new ReturnedToWarehouseState()
      : new DeliveryAttemptFailedState()
  }
}

export class DeliveryAttemptFailedState extends BaseShipmentState {
  readonly name: ShipmentStateName = 'DeliveryAttemptFailed'

  override advanceTransit(): ShipmentState {
    return new OutForDeliveryState()
  }

  override markDelivered(): ShipmentState {
    return new DeliveredState()
  }

  override recordFailedAttempt(_trackingNumber: string, shouldReturnToWarehouse: boolean): ShipmentState {
    return shouldReturnToWarehouse
      ? new ReturnedToWarehouseState()
      : new DeliveryAttemptFailedState()
  }
}

export class DeliveredState extends BaseShipmentState {
  readonly name: ShipmentStateName = 'Delivered'
  override readonly isTerminal = true

  override cancel(trackingNumber: string): ShipmentState {
    throw new InvalidStateTransitionError(this.name, 'cancel', trackingNumber)
  }
}

export class ReturnedToWarehouseState extends BaseShipmentState {
  readonly name: ShipmentStateName = 'ReturnedToWarehouse'
  override readonly isTerminal = true

  override cancel(trackingNumber: string): ShipmentState {
    throw new InvalidStateTransitionError(this.name, 'cancel', trackingNumber)
  }
}

export class CancelledState extends BaseShipmentState {
  readonly name: ShipmentStateName = 'Cancelled'
  override readonly isTerminal = true

  override cancel(trackingNumber: string): ShipmentState {
    throw new InvalidStateTransitionError(this.name, 'cancel', trackingNumber)
  }
}

export function createShipmentState(name: ShipmentStateName): ShipmentState {
  switch (name) {
    case 'PendingDispatch':
      return new PendingDispatchState()
    case 'Dispatched':
      return new DispatchedState()
    case 'InTransit':
      return new InTransitState()
    case 'OutForDelivery':
      return new OutForDeliveryState()
    case 'DeliveryAttemptFailed':
      return new DeliveryAttemptFailedState()
    case 'Delivered':
      return new DeliveredState()
    case 'ReturnedToWarehouse':
      return new ReturnedToWarehouseState()
    case 'Cancelled':
      return new CancelledState()
  }
}
