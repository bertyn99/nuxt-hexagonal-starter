import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import type { InspectorSnapshotDto } from '../../modules/hexagonal-kernel/shared/types/inspector'
import type { WarehouseBinDto } from '../../modules/warehouse/shared/types/warehouse'
import type {
  ShipmentDto,
  ShipmentTimelineDto,
  SlaEvaluationDto,
} from '../../modules/delivery/shared/types/delivery'

describe('End-to-End Logistics Flow (Real Nitro HTTP + SSR)', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('../..', import.meta.url)),
    nuxtConfig: {
      hexagonal: {
        persistence: 'drizzle-sqlite',
        carrier: 'simulated',
        clock: 'virtual',
        inspector: true,
        sqlitePath: ':memory:',
      },
    },
  })

  it('renders SSR pages across Host Shell, Warehouse module, and Delivery module', async () => {
    const [overviewHtml, warehouseHtml, deliveryHtml] = await Promise.all([
      $fetch<string>('/'),
      $fetch<string>('/warehouse'),
      $fetch<string>('/deliveries'),
    ])

    expect(overviewHtml).toContain('Operations Overview')
    expect(warehouseHtml).toContain('Warehouse Storage')
    expect(deliveryHtml).toContain('Delivery')
  })

  it('runs full flow: store parcel -> reject incompatible zone -> create shipment -> dispatch -> block cancel -> advance virtual clock -> breach SLA & inspect timeline', async () => {
    // 1. List seeded warehouse bins
    const bins = await $fetch<WarehouseBinDto[]>('/api/warehouse/bins')
    const ambientBin = bins.find(b => b.zone === 'AMBIENT')
    expect(ambientBin).toBeDefined()

    // 2. Verify domain invariant via HTTP: COLD_CHAIN cargo rejected in AMBIENT bin with 409
    const rejectedRes = await fetch('/api/warehouse/cargo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        binId: ambientBin!.id,
        kind: 'PARCEL',
        sku: 'SKU-E2E-COLD',
        label: 'Frozen Reagent',
        parcel: {
          sku: 'SKU-E2E-COLD',
          label: 'Frozen Reagent',
          weightKg: 5,
          lengthCm: 30,
          widthCm: 30,
          heightCm: 20,
          handlingClass: 'COLD_CHAIN',
        },
      }),
    })
    expect(rejectedRes.status).toBe(409)

    // 3. Store valid FRAGILE parcel into AMBIENT bin
    const stored = await $fetch<{ bin: WarehouseBinDto; storedCargoId: string }>(
      '/api/warehouse/cargo',
      {
        method: 'POST',
        body: {
          binId: ambientBin!.id,
          kind: 'PARCEL',
          sku: 'SKU-E2E-OPT',
          label: 'E2E Optical Lidar Unit',
          parcel: {
            sku: 'SKU-E2E-OPT',
            label: 'E2E Optical Lidar Unit',
            weightKg: 12,
            lengthCm: 50,
            widthCm: 40,
            heightCm: 30,
            handlingClass: 'FRAGILE',
          },
        },
      },
    )
    expect(stored.storedCargoId).toBeTruthy()

    // 4. Create EXPRESS_AIR shipment allocating that cargo via Delivery -> Warehouse ACL
    const createdShipment = await $fetch<ShipmentDto>('/api/deliveries', {
      method: 'POST',
      body: {
        cargoId: stored.storedCargoId,
        destination: 'Munich Robotics Lab, DE',
        carrierMode: 'EXPRESS_AIR',
      },
    })
    expect(createdShipment.state).toBe('PendingDispatch')
    expect(createdShipment.trackingNumber).toMatch(/^LOG-\d{4}-[A-Z0-9]{6}$/)

    // 5. Dispatch shipment
    const dispatched = await $fetch<ShipmentDto>(`/api/deliveries/${createdShipment.id}/dispatch`, {
      method: 'POST',
    })
    expect(dispatched.state).toBe('Dispatched')
    expect(dispatched.carrierReference).toMatch(/^AIR-/)

    // 6. Attempt illegal cancellation after dispatch -> HTTP 409
    const cancelRes = await fetch(`/api/deliveries/${createdShipment.id}/cancel`, {
      method: 'POST',
    })
    expect(cancelRes.status).toBe(409)

    // 7. Advance Virtual Clock +24h past Express Air 12h SLA window
    const clockSnap = await $fetch<InspectorSnapshotDto>('/api/_hexagonal/clock', {
      method: 'POST',
      body: { action: 'advance', hours: 24 },
    })
    expect(clockSnap.clock.offsetHours).toBeGreaterThanOrEqual(24)

    // 8. Evaluate SLAs -> verify breach detected
    const slaResult = await $fetch<SlaEvaluationDto>('/api/deliveries/evaluate-slas', {
      method: 'POST',
    })
    expect(slaResult.newlyBreachedCount).toBeGreaterThanOrEqual(1)
    expect(slaResult.breachedTrackingNumbers).toContain(createdShipment.trackingNumber)

    // 9. Verify Shipment Timeline contains ShipmentCreated, ShipmentDispatched, DeliverySlaBreached
    const timeline = await $fetch<ShipmentTimelineDto>(
      `/api/deliveries/${createdShipment.id}/timeline`,
    )
    const eventNames = timeline.events.map(e => e.eventName)
    expect(eventNames).toContain('ShipmentCreated')
    expect(eventNames).toContain('ShipmentDispatched')
    expect(eventNames).toContain('DeliverySlaBreached')

    // 10. Verify Architecture Inspector captured live traces
    const inspector = await $fetch<InspectorSnapshotDto>('/api/_hexagonal/inspector')
    expect(inspector.traces.length).toBeGreaterThan(0)
    expect(inspector.modules.map(m => m.name)).toEqual(
      expect.arrayContaining(['warehouse', 'delivery']),
    )
  })
})
