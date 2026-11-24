import { afterEach, describe, expect, it } from 'vitest'
import { DrizzleSqliteDriver } from '../../modules/hexagonal-kernel/core/infrastructure'
import type { ShipmentRepositoryPort } from '../../modules/delivery/core/application'
import {
  DrizzleSqliteShipmentRepository,
  InMemoryShipmentRepository,
} from '../../modules/delivery/core/infrastructure'
import { ShipmentBuilder } from '../helpers/builders'

interface RepositoryHarness {
  name: string
  create(): { repo: ShipmentRepositoryPort; teardown: () => void }
}

const harnesses: RepositoryHarness[] = [
  {
    name: 'InMemoryShipmentRepository',
    create() {
      const repo = new InMemoryShipmentRepository()
      return { repo, teardown: () => repo.clear() }
    },
  },
  {
    name: 'DrizzleSqliteShipmentRepository (:memory:)',
    create() {
      const driver = new DrizzleSqliteDriver(':memory:')
      const repo = new DrizzleSqliteShipmentRepository(driver)
      return { repo, teardown: () => driver.close() }
    },
  },
]

describe.each(harnesses)('ShipmentRepositoryPort Conformance Contract — $name', harness => {
  let teardown: (() => void) | null = null

  afterEach(() => {
    teardown?.()
    teardown = null
  })

  it('saves, queries by id/trackingNumber/filters, isolates unsaved mutations, updates, and deletes', async () => {
    const setup = harness.create()
    teardown = setup.teardown
    const { repo } = setup

    const now = new Date('2026-11-24T09:00:00.000Z')
    const airShipment = new ShipmentBuilder()
      .withId('shp-ct-1')
      .withTrackingNumber('LOG-2026-CT0001')
      .withCarrierMode('EXPRESS_AIR')
      .withNow(now)
      .build()

    const groundShipment = new ShipmentBuilder()
      .withId('shp-ct-2')
      .withTrackingNumber('LOG-2026-CT0002')
      .withCarrierMode('STANDARD_GROUND')
      .withNow(new Date(now.getTime() + 60_000))
      .build()
    groundShipment.dispatch('GRD-CT2', now)

    await repo.save(airShipment)
    await repo.save(groundShipment)

    // Find by ID & tracking number
    const loadedAir = await repo.findById('shp-ct-1')
    expect(loadedAir?.trackingNumber.value).toBe('LOG-2026-CT0001')

    const loadedByTracking = await repo.findByTrackingNumber('log-2026-ct0002')
    expect(loadedByTracking?.state).toBe('Dispatched')
    expect(loadedByTracking?.carrierReference).toBe('GRD-CT2')

    // Filter by state & carrierMode
    const dispatchedOnly = await repo.findAll({ state: 'Dispatched' })
    expect(dispatchedOnly).toHaveLength(1)
    expect(dispatchedOnly[0]?.id).toBe('shp-ct-2')

    const airOnly = await repo.findAll({ carrierMode: 'EXPRESS_AIR' })
    expect(airOnly).toHaveLength(1)
    expect(airOnly[0]?.id).toBe('shp-ct-1')

    // Isolation check: unsaved SLA breach must not leak
    loadedAir!.evaluateSla(new Date(now.getTime() + 20 * 60 * 60 * 1000))
    const untouched = await repo.findById('shp-ct-1')
    expect(untouched?.slaBreached).toBe(false)

    // Save SLA breach & verify slaBreachedOnly filter
    await repo.save(loadedAir!)
    const breached = await repo.findAll({ slaBreachedOnly: true })
    expect(breached).toHaveLength(1)
    expect(breached[0]?.id).toBe('shp-ct-1')

    // Delete
    await repo.delete('shp-ct-2')
    expect(await repo.findById('shp-ct-2')).toBeNull()
  })
})
