import { AggregateRoot } from '../../../../hexagonal-kernel/core/domain/aggregate-root'
import { ValidationDomainError } from '../../../../hexagonal-kernel/core/domain/domain-error'
import { assertHandlingClass } from '../../../../hexagonal-kernel/core/domain/handling-class'
import type { HandlingClass } from '../../../../hexagonal-kernel/core/domain/handling-class'
import {
  createDeliveryAttemptFailedEvent,
  createDeliverySlaBreachedEvent,
  createShipmentCancelledEvent,
  createShipmentCreatedEvent,
  createShipmentDeliveredEvent,
  createShipmentDispatchedEvent,
  createShipmentReturnedToWarehouseEvent,
  createShipmentTransitAdvancedEvent,
} from '../events/delivery.events'
import { resolveCarrierStrategy } from '../policies/carrier-strategy'
import type { CarrierMode } from '../policies/carrier-strategy'
import { createDeliveryExceptionChain } from '../policies/delivery-exception-chain'
import type {
  DeliveryExceptionHandler,
  DeliveryExceptionResolution,
} from '../policies/delivery-exception-chain'
import { createShipmentState } from '../states/shipment-state'
import type { ShipmentState, ShipmentStateName } from '../states/shipment-state'
import { DeliveryWindow } from '../value-objects/delivery-window'
import { Money } from '../value-objects/money'
import { TrackingNumber } from '../value-objects/tracking-number'

export interface CargoSummary {
  readonly cargoId: string
  readonly cargoKind: 'PARCEL' | 'PALLET'
  readonly sku: string
  readonly label: string
  readonly handlingClass: HandlingClass
  readonly weightKg: number
  readonly volumeM3: number
  readonly itemCount: number
}

export interface ShipmentSnapshot {
  readonly id: string
  readonly trackingNumber: string
  readonly originBinId: string
  readonly originBinCode: string
  readonly cargoSummary: CargoSummary
  readonly destination: string
  readonly carrierMode: CarrierMode
  readonly carrierReference: string | null
  readonly quotedCostCents: number
  readonly currency: string
  readonly promisedByIso: string
  readonly estimatedHours: number
  readonly state: ShipmentStateName
  readonly attemptCount: number
  readonly lastExceptionNote: string | null
  readonly slaBreached: boolean
  readonly createdAtIso: string
  readonly updatedAtIso: string
}

export class Shipment extends AggregateRoot<string> {
  readonly trackingNumber: TrackingNumber
  readonly originBinId: string
  readonly originBinCode: string
  readonly cargoSummary: Readonly<CargoSummary>
  readonly destination: string
  readonly carrierMode: CarrierMode
  readonly quotedCost: Money
  readonly deliveryWindow: DeliveryWindow
  readonly createdAtIso: string

  private _carrierReference: string | null
  private _state: ShipmentState
  private _attemptCount: number
  private _lastExceptionNote: string | null
  private _slaBreached: boolean
  private _updatedAtIso: string
  private readonly exceptionChain: DeliveryExceptionHandler

  private constructor(params: {
    id: string
    trackingNumber: TrackingNumber
    originBinId: string
    originBinCode: string
    cargoSummary: CargoSummary
    destination: string
    carrierMode: CarrierMode
    carrierReference: string | null
    quotedCost: Money
    deliveryWindow: DeliveryWindow
    state: ShipmentState
    attemptCount: number
    lastExceptionNote: string | null
    slaBreached: boolean
    createdAtIso: string
    updatedAtIso: string
  }) {
    super(params.id)
    this.trackingNumber = params.trackingNumber
    this.originBinId = params.originBinId
    this.originBinCode = params.originBinCode
    this.cargoSummary = Object.freeze({ ...params.cargoSummary })
    this.destination = params.destination
    this.carrierMode = params.carrierMode
    this._carrierReference = params.carrierReference
    this.quotedCost = params.quotedCost
    this.deliveryWindow = params.deliveryWindow
    this._state = params.state
    this._attemptCount = params.attemptCount
    this._lastExceptionNote = params.lastExceptionNote
    this._slaBreached = params.slaBreached
    this.createdAtIso = params.createdAtIso
    this._updatedAtIso = params.updatedAtIso
    this.exceptionChain = createDeliveryExceptionChain()
  }

  /**
   * Factory Method: validates invariants, quotes shipping cost & ETA via CarrierStrategy,
   * and emits ShipmentCreated domain event.
   */
  static create(params: {
    id: string
    originBinId: string
    originBinCode: string
    cargoSummary: CargoSummary
    destination: string
    carrierMode: CarrierMode
    now: Date
    trackingNumber?: TrackingNumber
  }): Shipment {
    const destination = params.destination.trim()
    if (destination.length < 3) {
      throw new ValidationDomainError(
        'INVALID_DESTINATION',
        'Destination must be at least 3 characters.',
      )
    }

    const handlingClass = assertHandlingClass(params.cargoSummary.handlingClass)
    const strategy = resolveCarrierStrategy(params.carrierMode)
    const quote = strategy.quote({
      weightKg: params.cargoSummary.weightKg,
      volumeM3: params.cargoSummary.volumeM3,
      handlingClass,
    })

    const trackingNumber = params.trackingNumber ?? TrackingNumber.generate(params.now)
    const deliveryWindow = DeliveryWindow.fromStartAndHours(params.now, quote.estimatedHours)
    const nowIso = params.now.toISOString()

    const shipment = new Shipment({
      id: params.id.trim(),
      trackingNumber,
      originBinId: params.originBinId,
      originBinCode: params.originBinCode,
      cargoSummary: { ...params.cargoSummary, handlingClass },
      destination,
      carrierMode: strategy.mode,
      carrierReference: null,
      quotedCost: quote.cost,
      deliveryWindow,
      state: createShipmentState('PendingDispatch'),
      attemptCount: 0,
      lastExceptionNote: null,
      slaBreached: false,
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    })

    shipment.recordEvent(
      createShipmentCreatedEvent({
        shipmentId: shipment.id,
        trackingNumber: shipment.trackingNumber.value,
        originBinId: shipment.originBinId,
        cargoId: shipment.cargoSummary.cargoId,
        destination: shipment.destination,
        carrierMode: shipment.carrierMode,
        quotedCostCents: shipment.quotedCost.amountCents,
        currency: shipment.quotedCost.currency,
        promisedBy: shipment.deliveryWindow.promisedByIso,
        occurredAt: params.now,
      }),
    )

    return shipment
  }

  /**
   * Factory Method: reconstitutes a Shipment from persistence without emitting creation events.
   */
  static rehydrate(snapshot: ShipmentSnapshot): Shipment {
    return new Shipment({
      id: snapshot.id,
      trackingNumber: TrackingNumber.create(snapshot.trackingNumber),
      originBinId: snapshot.originBinId,
      originBinCode: snapshot.originBinCode,
      cargoSummary: {
        ...snapshot.cargoSummary,
        handlingClass: assertHandlingClass(snapshot.cargoSummary.handlingClass),
      },
      destination: snapshot.destination,
      carrierMode: snapshot.carrierMode,
      carrierReference: snapshot.carrierReference,
      quotedCost: Money.fromCents(snapshot.quotedCostCents, snapshot.currency),
      deliveryWindow: DeliveryWindow.fromIso(snapshot.promisedByIso, snapshot.estimatedHours),
      state: createShipmentState(snapshot.state),
      attemptCount: snapshot.attemptCount,
      lastExceptionNote: snapshot.lastExceptionNote,
      slaBreached: snapshot.slaBreached,
      createdAtIso: snapshot.createdAtIso,
      updatedAtIso: snapshot.updatedAtIso,
    })
  }

  get state(): ShipmentStateName {
    return this._state.name
  }

  get isTerminal(): boolean {
    return this._state.isTerminal
  }

  get carrierReference(): string | null {
    return this._carrierReference
  }

  get attemptCount(): number {
    return this._attemptCount
  }

  get lastExceptionNote(): string | null {
    return this._lastExceptionNote
  }

  get slaBreached(): boolean {
    return this._slaBreached
  }

  get updatedAtIso(): string {
    return this._updatedAtIso
  }

  dispatch(carrierReference: string, now: Date): void {
    const next = this._state.dispatch(this.trackingNumber.value)
    this._state = next
    this._carrierReference = carrierReference
    this._updatedAtIso = now.toISOString()

    this.recordEvent(
      createShipmentDispatchedEvent({
        shipmentId: this.id,
        trackingNumber: this.trackingNumber.value,
        carrierMode: this.carrierMode,
        carrierReference,
        occurredAt: now,
      }),
    )
  }

  advanceTransit(now: Date, locationNote?: string): ShipmentStateName {
    const previous = this._state.name
    const next = this._state.advanceTransit(this.trackingNumber.value)
    this._state = next
    this._updatedAtIso = now.toISOString()

    this.recordEvent(
      createShipmentTransitAdvancedEvent({
        shipmentId: this.id,
        trackingNumber: this.trackingNumber.value,
        previousState: previous,
        nextState: next.name,
        locationNote,
        occurredAt: now,
      }),
    )

    return next.name
  }

  markDelivered(now: Date, recipientNote?: string): void {
    const next = this._state.markDelivered(this.trackingNumber.value)
    this._state = next
    this._updatedAtIso = now.toISOString()

    this.recordEvent(
      createShipmentDeliveredEvent({
        shipmentId: this.id,
        trackingNumber: this.trackingNumber.value,
        recipientNote,
        occurredAt: now,
      }),
    )
  }

  recordFailedAttempt(reason: string, now: Date): DeliveryExceptionResolution {
    const cleanReason = reason.trim() || 'Recipient unavailable'
    const nextAttempt = this._attemptCount + 1
    const resolution = this.exceptionChain.handle({
      attemptNumber: nextAttempt,
      reason: cleanReason,
    })

    const nextState = this._state.recordFailedAttempt(
      this.trackingNumber.value,
      resolution.shouldReturnToWarehouse,
    )

    this._attemptCount = nextAttempt
    this._lastExceptionNote = resolution.note
    this._state = nextState
    this._updatedAtIso = now.toISOString()

    this.recordEvent(
      createDeliveryAttemptFailedEvent({
        shipmentId: this.id,
        trackingNumber: this.trackingNumber.value,
        attemptNumber: nextAttempt,
        reason: cleanReason,
        resolutionAction: resolution.action,
        occurredAt: now,
      }),
    )

    if (resolution.shouldReturnToWarehouse) {
      this.recordEvent(
        createShipmentReturnedToWarehouseEvent({
          shipmentId: this.id,
          trackingNumber: this.trackingNumber.value,
          originBinId: this.originBinId,
          cargoId: this.cargoSummary.cargoId,
          reason: resolution.note,
          occurredAt: now,
        }),
      )
    }

    return resolution
  }

  cancel(reason: string, now: Date): void {
    const next = this._state.cancel(this.trackingNumber.value)
    this._state = next
    this._updatedAtIso = now.toISOString()

    this.recordEvent(
      createShipmentCancelledEvent({
        shipmentId: this.id,
        trackingNumber: this.trackingNumber.value,
        originBinId: this.originBinId,
        cargoId: this.cargoSummary.cargoId,
        reason: reason.trim() || 'Cancelled by dispatcher',
        occurredAt: now,
      }),
    )
  }

  evaluateSla(now: Date): boolean {
    if (this._state.isTerminal) {
      return false
    }
    if (!this.deliveryWindow.isBreached(now)) {
      return false
    }
    if (this._slaBreached) {
      return false
    }

    this._slaBreached = true
    this._updatedAtIso = now.toISOString()
    const overdueHours = Math.abs(this.deliveryWindow.remainingHours(now))

    this.recordEvent(
      createDeliverySlaBreachedEvent({
        shipmentId: this.id,
        trackingNumber: this.trackingNumber.value,
        promisedBy: this.deliveryWindow.promisedByIso,
        detectedAt: now.toISOString(),
        overdueHours,
        occurredAt: now,
      }),
    )

    return true
  }

  toSnapshot(): ShipmentSnapshot {
    return {
      id: this.id,
      trackingNumber: this.trackingNumber.value,
      originBinId: this.originBinId,
      originBinCode: this.originBinCode,
      cargoSummary: { ...this.cargoSummary },
      destination: this.destination,
      carrierMode: this.carrierMode,
      carrierReference: this._carrierReference,
      quotedCostCents: this.quotedCost.amountCents,
      currency: this.quotedCost.currency,
      promisedByIso: this.deliveryWindow.promisedByIso,
      estimatedHours: this.deliveryWindow.estimatedHours,
      state: this._state.name,
      attemptCount: this._attemptCount,
      lastExceptionNote: this._lastExceptionNote,
      slaBreached: this._slaBreached,
      createdAtIso: this.createdAtIso,
      updatedAtIso: this._updatedAtIso,
    }
  }
}
