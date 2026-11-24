import { z } from 'zod'

export const carrierModeSchema = z.enum(['STANDARD_GROUND', 'EXPRESS_AIR', 'COLD_CHAIN_COURIER'])
export const shipmentStateSchema = z.enum([
  'PendingDispatch',
  'Dispatched',
  'InTransit',
  'OutForDelivery',
  'DeliveryAttemptFailed',
  'Delivered',
  'ReturnedToWarehouse',
  'Cancelled',
])
export const deliveryHandlingClassSchema = z.enum(['STANDARD', 'FRAGILE', 'COLD_CHAIN', 'HAZMAT'])

export const createShipmentRequestSchema = z.object({
  cargoId: z.string().trim().min(1, 'Please choose an available warehouse cargo unit'),
  destination: z.string().trim().min(3, 'Destination must be at least 3 characters').max(160),
  carrierMode: carrierModeSchema,
})

export const quoteShipmentRequestSchema = z.object({
  carrierMode: carrierModeSchema,
  weightKg: z.coerce.number().positive(),
  volumeM3: z.coerce.number().positive(),
  handlingClass: deliveryHandlingClassSchema,
})

export const advanceTransitRequestSchema = z.object({
  locationNote: z.string().trim().max(140).optional(),
}).optional()

export const markDeliveredRequestSchema = z.object({
  recipientNote: z.string().trim().max(140).optional(),
}).optional()

export const recordAttemptFailureRequestSchema = z.object({
  reason: z.string().trim().min(2, 'Please provide a failure reason').max(160).default('Recipient unavailable at dock'),
})

export const cancelShipmentRequestSchema = z.object({
  reason: z.string().trim().max(160).optional(),
}).optional()

export type CreateShipmentRequest = z.infer<typeof createShipmentRequestSchema>
export type QuoteShipmentRequest = z.infer<typeof quoteShipmentRequestSchema>
export type RecordAttemptFailureRequest = z.infer<typeof recordAttemptFailureRequestSchema>
