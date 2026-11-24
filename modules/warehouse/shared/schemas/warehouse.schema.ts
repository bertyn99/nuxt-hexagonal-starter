import { z } from 'zod'

export const handlingClassSchema = z.enum(['STANDARD', 'FRAGILE', 'COLD_CHAIN', 'HAZMAT'])
export const storageZoneSchema = z.enum(['AMBIENT', 'COLD_CHAIN', 'HAZMAT'])

export const parcelItemSchema = z.object({
  sku: z.string().trim().min(2, 'SKU must be at least 2 characters').max(40),
  label: z.string().trim().min(2, 'Label must be at least 2 characters').max(120),
  weightKg: z.coerce.number().positive('Weight must be > 0 kg').max(5000),
  lengthCm: z.coerce.number().positive('Length must be > 0 cm').max(500),
  widthCm: z.coerce.number().positive('Width must be > 0 cm').max(500),
  heightCm: z.coerce.number().positive('Height must be > 0 cm').max(500),
  handlingClass: handlingClassSchema,
})

export const receiveParcelRequestSchema = z.object({
  binId: z.string().trim().min(1, 'Please select a target bin'),
  kind: z.literal('PARCEL'),
  sku: z.string().trim().min(2, 'SKU must be at least 2 characters').max(40),
  label: z.string().trim().min(2, 'Label must be at least 2 characters').max(120),
  parcel: parcelItemSchema,
})

export const receivePalletRequestSchema = z.object({
  binId: z.string().trim().min(1, 'Please select a target bin'),
  kind: z.literal('PALLET'),
  sku: z.string().trim().min(2, 'Pallet SKU must be at least 2 characters').max(40),
  label: z.string().trim().min(2, 'Pallet label must be at least 2 characters').max(120),
  tareWeightKg: z.coerce.number().min(0, 'Tare weight must be >= 0').max(200).default(15),
  items: z.array(parcelItemSchema).min(1, 'A pallet must contain at least 1 parcel').max(20),
})

export const receiveCargoRequestSchema = z.discriminatedUnion('kind', [
  receiveParcelRequestSchema,
  receivePalletRequestSchema,
])

export type ParcelItemForm = z.infer<typeof parcelItemSchema>
export type ReceiveCargoRequest = z.infer<typeof receiveCargoRequestSchema>
