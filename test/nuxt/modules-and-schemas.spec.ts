import { describe, expect, it } from 'vitest'
import { useRouter } from '#imports'
import {
  loginRequestSchema,
  switchPersonaRequestSchema,
} from '../../modules/auth/shared/schemas/auth.schema'
import { receiveCargoRequestSchema } from '../../modules/warehouse/shared/schemas/warehouse.schema'
import { createShipmentRequestSchema } from '../../modules/delivery/shared/schemas/delivery.schema'

describe('Nuxt 4 Local Modules & Shared Schemas', () => {
  it('auto-registers bounded-context pages /warehouse, /deliveries, and /login via extendPages', () => {
    const router = useRouter()
    const paths = router.getRoutes().map(r => r.path)

    expect(paths).toContain('/')
    expect(paths).toContain('/login')
    expect(paths).toContain('/warehouse')
    expect(paths).toContain('/deliveries')
  })

  it('validates Auth shared Zod schemas for login and persona switching', () => {
    expect(
      loginRequestSchema.safeParse({
        email: 'admin@hexlogix.dev',
        password: 'hexlogix-demo',
      }).success,
    ).toBe(true)

    expect(
      loginRequestSchema.safeParse({
        email: 'not-an-email',
        password: '',
      }).success,
    ).toBe(false)

    expect(switchPersonaRequestSchema.safeParse({ userId: 'usr-admin' }).success).toBe(true)
    expect(switchPersonaRequestSchema.safeParse({ userId: '' }).success).toBe(false)
  })

  it('validates Warehouse shared Zod schemas for both Parcel and Composite Pallet', () => {
    const validParcel = receiveCargoRequestSchema.safeParse({
      binId: 'bin-a01',
      kind: 'PARCEL',
      sku: 'SKU-100',
      label: 'Sensor Kit',
      parcel: {
        sku: 'SKU-100',
        label: 'Sensor Kit',
        weightKg: 8.5,
        lengthCm: 40,
        widthCm: 30,
        heightCm: 20,
        handlingClass: 'FRAGILE',
      },
    })
    expect(validParcel.success).toBe(true)

    const emptyPallet = receiveCargoRequestSchema.safeParse({
      binId: 'bin-a01',
      kind: 'PALLET',
      sku: 'PLT-1',
      label: 'Empty Pallet',
      tareWeightKg: 10,
      items: [],
    })
    expect(emptyPallet.success).toBe(false)
  })

  it('validates Delivery shared Zod schemas for CreateShipment', () => {
    const valid = createShipmentRequestSchema.safeParse({
      cargoId: 'cargo-elec-01',
      destination: 'Rotterdam Port, NL',
      carrierMode: 'EXPRESS_AIR',
    })
    expect(valid.success).toBe(true)

    const invalid = createShipmentRequestSchema.safeParse({
      cargoId: '',
      destination: 'X',
      carrierMode: 'TELEPORT',
    })
    expect(invalid.success).toBe(false)
  })
})
