export type DeliveryExceptionResolutionAction
  = | 'SCHEDULE_NEXT_DAY_RETRY'
    | 'HOLD_AT_LOCAL_HUB'
    | 'RETURN_TO_WAREHOUSE'

export interface DeliveryExceptionContext {
  readonly attemptNumber: number
  readonly reason: string
}

export interface DeliveryExceptionResolution {
  readonly action: DeliveryExceptionResolutionAction
  readonly shouldReturnToWarehouse: boolean
  readonly note: string
}

export interface DeliveryExceptionHandler {
  setNext(handler: DeliveryExceptionHandler): DeliveryExceptionHandler
  handle(context: DeliveryExceptionContext): DeliveryExceptionResolution
}

abstract class BaseDeliveryExceptionHandler implements DeliveryExceptionHandler {
  private nextHandler: DeliveryExceptionHandler | null = null

  setNext(handler: DeliveryExceptionHandler): DeliveryExceptionHandler {
    this.nextHandler = handler
    return handler
  }

  handle(context: DeliveryExceptionContext): DeliveryExceptionResolution {
    const decision = this.tryHandle(context)
    if (decision) {
      return decision
    }
    if (this.nextHandler) {
      return this.nextHandler.handle(context)
    }
    return {
      action: 'RETURN_TO_WAREHOUSE',
      shouldReturnToWarehouse: true,
      note: 'Maximum delivery attempts exceeded; returning cargo to origin warehouse.',
    }
  }

  protected abstract tryHandle(context: DeliveryExceptionContext): DeliveryExceptionResolution | null
}

export class FirstAttemptRetryHandler extends BaseDeliveryExceptionHandler {
  protected tryHandle(context: DeliveryExceptionContext): DeliveryExceptionResolution | null {
    if (context.attemptNumber === 1) {
      return {
        action: 'SCHEDULE_NEXT_DAY_RETRY',
        shouldReturnToWarehouse: false,
        note: `Attempt #1 failed (${context.reason}). Scheduled automatic courier retry.`,
      }
    }
    return null
  }
}

export class SecondAttemptHubHoldHandler extends BaseDeliveryExceptionHandler {
  protected tryHandle(context: DeliveryExceptionContext): DeliveryExceptionResolution | null {
    if (context.attemptNumber === 2) {
      return {
        action: 'HOLD_AT_LOCAL_HUB',
        shouldReturnToWarehouse: false,
        note: `Attempt #2 failed (${context.reason}). Holding shipment at local distribution hub for final attempt.`,
      }
    }
    return null
  }
}

export class ThirdAttemptReturnToWarehouseHandler extends BaseDeliveryExceptionHandler {
  protected tryHandle(context: DeliveryExceptionContext): DeliveryExceptionResolution | null {
    if (context.attemptNumber >= 3) {
      return {
        action: 'RETURN_TO_WAREHOUSE',
        shouldReturnToWarehouse: true,
        note: `Attempt #${context.attemptNumber} failed (${context.reason}). Max attempts reached — initiating return to warehouse.`,
      }
    }
    return null
  }
}

/**
 * Chain of Responsibility: Attempt 1 Retry -> Attempt 2 Hub Hold -> Attempt 3 Return to Warehouse.
 */
export function createDeliveryExceptionChain(): DeliveryExceptionHandler {
  const first = new FirstAttemptRetryHandler()
  const second = new SecondAttemptHubHoldHandler()
  const third = new ThirdAttemptReturnToWarehouseHandler()
  first.setNext(second).setNext(third)
  return first
}
