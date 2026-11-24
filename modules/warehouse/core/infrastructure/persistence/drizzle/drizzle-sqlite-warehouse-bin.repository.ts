import { asc, eq } from 'drizzle-orm'
import type { DrizzleSqliteDriver } from '../../../../../hexagonal-kernel/core/infrastructure/persistence/drizzle-sqlite-driver'
import type { WarehouseBinRepositoryPort } from '../../../application/ports/outbound/warehouse-bin-repository.port'
import type { WarehouseBin } from '../../../domain/entities/warehouse-bin'
import type { StorageZone } from '../../../domain/value-objects/storage-zone'
import { fromWarehouseBinRecord, toWarehouseBinRecord } from '../warehouse-bin.mapper'
import { warehouseBinsTable } from './warehouse.schema'

export class DrizzleSqliteWarehouseBinRepository implements WarehouseBinRepositoryPort {
  constructor(private readonly driver: DrizzleSqliteDriver) {
    this.ensureSchema()
  }

  ensureSchema(): void {
    this.driver.execDDL(`
      CREATE TABLE IF NOT EXISTS warehouse_bins (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        zone TEXT NOT NULL,
        max_weight_kg REAL NOT NULL,
        max_volume_m3 REAL NOT NULL,
        stored_entries_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_warehouse_bins_zone
        ON warehouse_bins (zone, code);
    `)
  }

  async findById(binId: string): Promise<WarehouseBin | null> {
    const row = this.driver.db
      .select()
      .from(warehouseBinsTable)
      .where(eq(warehouseBinsTable.id, binId))
      .get()

    if (!row) {
      return null
    }
    return fromWarehouseBinRecord({
      ...row,
      zone: row.zone as StorageZone,
    })
  }

  async findByCode(code: string): Promise<WarehouseBin | null> {
    const upper = code.trim().toUpperCase()
    const row = this.driver.db
      .select()
      .from(warehouseBinsTable)
      .where(eq(warehouseBinsTable.code, upper))
      .get()

    if (!row) {
      return null
    }
    return fromWarehouseBinRecord({
      ...row,
      zone: row.zone as StorageZone,
    })
  }

  async findByCargoId(cargoId: string): Promise<WarehouseBin | null> {
    const rows = this.driver.db.select().from(warehouseBinsTable).all()

    for (const row of rows) {
      if (row.storedEntriesJson.includes(cargoId)) {
        const bin = fromWarehouseBinRecord({
          ...row,
          zone: row.zone as StorageZone,
        })
        if (bin.findCargo(cargoId)) {
          return bin
        }
      }
    }
    return null
  }

  async findAll(filter?: { zone?: StorageZone }): Promise<WarehouseBin[]> {
    const query = filter?.zone
      ? this.driver.db
          .select()
          .from(warehouseBinsTable)
          .where(eq(warehouseBinsTable.zone, filter.zone))
          .orderBy(asc(warehouseBinsTable.code))
      : this.driver.db.select().from(warehouseBinsTable).orderBy(asc(warehouseBinsTable.code))

    return query.all().map(row =>
      fromWarehouseBinRecord({
        ...row,
        zone: row.zone as StorageZone,
      }),
    )
  }

  async save(bin: WarehouseBin): Promise<void> {
    const record = toWarehouseBinRecord(bin)
    this.driver.db
      .insert(warehouseBinsTable)
      .values(record)
      .onConflictDoUpdate({
        target: warehouseBinsTable.id,
        set: {
          code: record.code,
          zone: record.zone,
          maxWeightKg: record.maxWeightKg,
          maxVolumeM3: record.maxVolumeM3,
          storedEntriesJson: record.storedEntriesJson,
        },
      })
      .run()
  }

  async delete(binId: string): Promise<void> {
    this.driver.db.delete(warehouseBinsTable).where(eq(warehouseBinsTable.id, binId)).run()
  }
}
