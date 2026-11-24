import { afterEach, describe, expect, it } from 'vitest'
import { DrizzleSqliteDriver } from '../../modules/hexagonal-kernel/core/infrastructure'
import type { WarehouseBinRepositoryPort } from '../../modules/warehouse/core/application'
import {
  DrizzleSqliteWarehouseBinRepository,
  InMemoryWarehouseBinRepository,
} from '../../modules/warehouse/core/infrastructure'
import { createSamplePallet, ParcelBuilder, WarehouseBinBuilder } from '../helpers/builders'

interface RepositoryHarness {
  name: string
  create(): { repo: WarehouseBinRepositoryPort; teardown: () => void }
}

const harnesses: RepositoryHarness[] = [
  {
    name: 'InMemoryWarehouseBinRepository',
    create() {
      const repo = new InMemoryWarehouseBinRepository()
      return { repo, teardown: () => repo.clear() }
    },
  },
  {
    name: 'DrizzleSqliteWarehouseBinRepository (:memory:)',
    create() {
      const driver = new DrizzleSqliteDriver(':memory:')
      const repo = new DrizzleSqliteWarehouseBinRepository(driver)
      return { repo, teardown: () => driver.close() }
    },
  },
]

describe.each(harnesses)('WarehouseBinRepositoryPort Conformance Contract — $name', harness => {
  let teardown: (() => void) | null = null

  afterEach(() => {
    teardown?.()
    teardown = null
  })

  it('saves, finds by id/code/cargoId, filters by zone, preserves Composite Pallet fidelity, and deletes', async () => {
    const setup = harness.create()
    teardown = setup.teardown
    const { repo } = setup

    const now = new Date('2026-11-24T12:00:00.000Z')
    const ambientBin = new WarehouseBinBuilder()
      .withId('bin-contract-1')
      .withCode('BAY-CT01')
      .withZone('AMBIENT')
      .build()

    const parcel = new ParcelBuilder().withId('cargo-ct-1').withWeightKg(18).build()
    ambientBin.storeCargo(parcel, now)

    const hazmatBin = new WarehouseBinBuilder()
      .withId('bin-contract-2')
      .withCode('BAY-HZ01')
      .withZone('HAZMAT')
      .build()
    const pallet = createSamplePallet('plt-ct-2')
    hazmatBin.storeCargo(pallet, now)

    await repo.save(ambientBin)
    await repo.save(hazmatBin)

    // Find by ID
    const loadedAmbient = await repo.findById('bin-contract-1')
    expect(loadedAmbient?.code).toBe('BAY-CT01')
    expect(loadedAmbient?.storedEntries).toHaveLength(1)

    // Find by code (case-insensitive)
    const loadedByCode = await repo.findByCode('bay-hz01')
    expect(loadedByCode?.id).toBe('bin-contract-2')
    const reconstitutedPallet = loadedByCode?.findCargo('plt-ct-2')?.unit
    expect(reconstitutedPallet?.kind).toBe('PALLET')
    expect(reconstitutedPallet?.getWeight().kilograms).toBe(45)
    expect(reconstitutedPallet?.getHandlingClass()).toBe('HAZMAT')

    // Find by cargoId
    const byCargo = await repo.findByCargoId('cargo-ct-1')
    expect(byCargo?.id).toBe('bin-contract-1')

    // Filter by zone
    const hazmatOnly = await repo.findAll({ zone: 'HAZMAT' })
    expect(hazmatOnly).toHaveLength(1)
    expect(hazmatOnly[0]?.id).toBe('bin-contract-2')

    // Isolation check: unsaved mutation must not leak into repository
    loadedAmbient!.allocateCargo('cargo-ct-1', 'shp-unsaved', now)
    const freshRead = await repo.findById('bin-contract-1')
    expect(freshRead?.findCargo('cargo-ct-1')?.status).toBe('AVAILABLE')

    // Persist mutation & verify update
    await repo.save(loadedAmbient!)
    const updatedRead = await repo.findById('bin-contract-1')
    expect(updatedRead?.findCargo('cargo-ct-1')?.status).toBe('ALLOCATED')

    // Delete
    await repo.delete('bin-contract-1')
    expect(await repo.findById('bin-contract-1')).toBeNull()
  })
})
