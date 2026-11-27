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

function extractCookieHeader(response: Response): string {
  const setCookies = response.headers.getSetCookie?.() ?? []
  if (setCookies.length > 0) {
    return setCookies.map(c => c.split(';')[0]).join('; ')
  }
  const single = response.headers.get('set-cookie')
  return single ? single.split(';')[0]! : ''
}

async function loginAs(email: string, password = 'hexlogix-demo'): Promise<string> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  expect(res.status).toBe(200)
  const cookie = extractCookieHeader(res)
  expect(cookie).toContain('nuxt-auth-session=')
  return cookie
}

describe('End-to-End Logistics & RBAC Flow (Real Nitro HTTP + SSR)', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('../..', import.meta.url)),
    nuxtConfig: {
      runtimeConfig: {
        appSecret: 'e2e-test-app-secret-with-at-least-32-characters-hexlogix',
        session: {
          cookie: {
            secure: false,
          },
        },
      },
      hexagonal: {
        persistence: 'drizzle-sqlite',
        carrier: 'simulated',
        clock: 'virtual',
        inspector: true,
        sqlitePath: ':memory:',
      },
    },
  })

  it('renders SSR pages across Host Shell, Auth, Warehouse, and Delivery modules', async () => {
    const [overviewHtml, loginHtml, warehouseHtml, deliveryHtml] = await Promise.all([
      $fetch<string>('/'),
      $fetch<string>('/login'),
      $fetch<string>('/warehouse'),
      $fetch<string>('/deliveries'),
    ])

    expect(overviewHtml).toContain('Operations Overview')
    expect(loginHtml).toContain('Authentication')
    expect(warehouseHtml).toContain('Warehouse Storage')
    expect(deliveryHtml).toContain('Delivery')
  })

  it('enforces 401/403 RBAC across roles and executes full authenticated WMS + TMS flow', async () => {
    // 0. Verify all bounded contexts registered eagerly on Nitro boot (before calling /api/auth/*)
    const initialInspector = await $fetch<InspectorSnapshotDto>('/api/_hexagonal/inspector')
    expect(initialInspector.modules.map(m => m.name)).toEqual(
      expect.arrayContaining(['auth', 'warehouse', 'delivery']),
    )

    // 1. Read endpoints work for visibility
    const bins = await $fetch<WarehouseBinDto[]>('/api/warehouse/bins')
    const ambientBin = bins.find(b => b.zone === 'AMBIENT')
    expect(ambientBin).toBeDefined()

    const validCargoPayload = {
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
    }

    // 2. Anonymous write is rejected with 401 Unauthorized
    const unauthRes = await fetch('/api/warehouse/cargo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validCargoPayload),
    })
    expect(unauthRes.status).toBe(401)

    // 3. Viewer role is authenticated but forbidden (403) from warehouse writes & inspector clock
    const viewerCookie = await loginAs('viewer@hexlogix.dev')
    const viewerWarehouseRes = await fetch('/api/warehouse/cargo', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: viewerCookie },
      body: JSON.stringify(validCargoPayload),
    })
    expect(viewerWarehouseRes.status).toBe(403)

    const viewerClockRes = await fetch('/api/_hexagonal/clock', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: viewerCookie },
      body: JSON.stringify({ action: 'advance', hours: 4 }),
    })
    expect(viewerClockRes.status).toBe(403)

    // 4. Warehouse Operator can store cargo (and hits 409 domain invariant on incompatible zone)
    const warehouseCookie = await loginAs('warehouse@hexlogix.dev')
    const rejectedZoneRes = await fetch('/api/warehouse/cargo', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: warehouseCookie },
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
    expect(rejectedZoneRes.status).toBe(409)

    const stored = await $fetch<{ bin: WarehouseBinDto; storedCargoId: string }>(
      '/api/warehouse/cargo',
      {
        method: 'POST',
        headers: { cookie: warehouseCookie },
        body: validCargoPayload,
      },
    )
    expect(stored.storedCargoId).toBeTruthy()

    // Warehouse Operator cannot create TMS shipments (403 Forbidden)
    const warehouseCreateShipmentRes = await fetch('/api/deliveries', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: warehouseCookie },
      body: JSON.stringify({
        cargoId: stored.storedCargoId,
        destination: 'Munich Robotics Lab, DE',
        carrierMode: 'EXPRESS_AIR',
      }),
    })
    expect(warehouseCreateShipmentRes.status).toBe(403)

    // 5. Dispatcher creates EXPRESS_AIR shipment allocating cargo via Delivery -> Warehouse ACL
    const dispatcherCookie = await loginAs('dispatcher@hexlogix.dev')
    const createdShipment = await $fetch<ShipmentDto>('/api/deliveries', {
      method: 'POST',
      headers: { cookie: dispatcherCookie },
      body: {
        cargoId: stored.storedCargoId,
        destination: 'Munich Robotics Lab, DE',
        carrierMode: 'EXPRESS_AIR',
      },
    })
    expect(createdShipment.state).toBe('PendingDispatch')
    expect(createdShipment.trackingNumber).toMatch(/^LOG-\d{4}-[A-Z0-9]{6}$/)

    // 6. Dispatcher dispatches shipment and hits 409 on illegal cancellation
    const dispatched = await $fetch<ShipmentDto>(`/api/deliveries/${createdShipment.id}/dispatch`, {
      method: 'POST',
      headers: { cookie: dispatcherCookie },
    })
    expect(dispatched.state).toBe('Dispatched')
    expect(dispatched.carrierReference).toMatch(/^AIR-/)

    const cancelRes = await fetch(`/api/deliveries/${createdShipment.id}/cancel`, {
      method: 'POST',
      headers: { cookie: dispatcherCookie },
    })
    expect(cancelRes.status).toBe(409)

    // Dispatcher cannot manipulate Virtual Clock (403 Forbidden)
    const dispatcherClockRes = await fetch('/api/_hexagonal/clock', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: dispatcherCookie },
      body: JSON.stringify({ action: 'advance', hours: 24 }),
    })
    expect(dispatcherClockRes.status).toBe(403)

    // 7. Admin advances Virtual Clock +24h past Express Air 12h SLA window
    const adminCookie = await loginAs('admin@hexlogix.dev')
    const clockSnap = await $fetch<InspectorSnapshotDto>('/api/_hexagonal/clock', {
      method: 'POST',
      headers: { cookie: adminCookie },
      body: { action: 'advance', hours: 24 },
    })
    expect(clockSnap.clock.offsetHours).toBeGreaterThanOrEqual(24)

    // 8. Evaluate SLAs -> verify breach detected
    const slaResult = await $fetch<SlaEvaluationDto>('/api/deliveries/evaluate-slas', {
      method: 'POST',
      headers: { cookie: dispatcherCookie },
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

    // 10. Verify switching persona or re-logging in replaces session roles (no defu array accumulation)
    const switchToWarehouseRes = await fetch('/api/auth/switch-persona', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({ userId: 'usr-warehouse' }),
    })
    expect(switchToWarehouseRes.status).toBe(200)
    const switchedWarehouseCookie = extractCookieHeader(switchToWarehouseRes)
    const switchedSession = await $fetch<{
      authenticated: boolean
      user: { id: string; roles: string[] } | null
    }>('/api/auth/session', {
      headers: { cookie: switchedWarehouseCookie },
    })
    expect(switchedSession.authenticated).toBe(true)
    expect(switchedSession.user?.id).toBe('usr-warehouse')
    expect(switchedSession.user?.roles).toEqual(['warehouse_operator'])

    // Switched warehouse operator must NOT retain admin permissions on TMS or Inspector
    const switchedClockRes = await fetch('/api/_hexagonal/clock', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: switchedWarehouseCookie },
      body: JSON.stringify({ action: 'advance', hours: 2 }),
    })
    expect(switchedClockRes.status).toBe(403)

    // 11. Verify Architecture Inspector captured live traces & registered auth/warehouse/delivery modules
    const inspector = await $fetch<InspectorSnapshotDto>('/api/_hexagonal/inspector')
    expect(inspector.traces.length).toBeGreaterThan(0)
    expect(
      inspector.traces.some(trace => trace.steps.some(step => step.layer === 'authorization')),
    ).toBe(true)
    expect(inspector.modules.map(m => m.name)).toEqual(
      expect.arrayContaining(['auth', 'warehouse', 'delivery']),
    )
  })
})
