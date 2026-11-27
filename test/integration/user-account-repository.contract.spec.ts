import { describe, expect, it } from 'vitest'
import { DrizzleSqliteDriver } from '../../modules/hexagonal-kernel/core/infrastructure/persistence/drizzle-sqlite-driver'
import type { UserAccountRepositoryPort } from '../../modules/auth/core/application/ports/outbound/user-account-repository.port'
import { UserAccount } from '../../modules/auth/core/domain/entities/user-account'
import { DrizzleSqliteUserAccountRepository } from '../../modules/auth/core/infrastructure/persistence/drizzle/drizzle-sqlite-user-account.repository'
import { InMemoryUserAccountRepository } from '../../modules/auth/core/infrastructure/persistence/in-memory/in-memory-user-account.repository'
import { ScryptPasswordHasherAdapter } from '../../modules/auth/core/infrastructure/security/scrypt-password-hasher.adapter'

function runUserAccountRepositoryContractTests(
  adapterLabel: string,
  createAdapter: () => { repo: UserAccountRepositoryPort; cleanup: () => void },
) {
  describe(`UserAccountRepositoryPort Contract [${adapterLabel}]`, () => {
    it('saves, queries by id & case-insensitive email, and updates existing accounts', async () => {
      const { repo, cleanup } = createAdapter()
      try {
        const now = new Date('2026-06-01T10:00:00Z')
        const admin = UserAccount.create({
          id: 'usr-contract-1',
          email: 'Admin@HexLogix.dev',
          name: 'Contract Admin',
          roles: ['admin'],
          passwordHash: 'scrypt:salt:deadbeef',
          now,
        })

        await repo.save(admin)

        const byId = await repo.findById('usr-contract-1')
        expect(byId).not.toBeNull()
        expect(byId?.email).toBe('admin@hexlogix.dev')
        expect(byId?.roles).toEqual(['admin'])

        const byEmail = await repo.findByEmail('ADMIN@hexlogix.dev')
        expect(byEmail?.id).toBe('usr-contract-1')

        const updated = UserAccount.rehydrate({
          ...admin.toSnapshot(),
          roles: ['warehouse_operator', 'dispatcher'],
          active: false,
        })
        await repo.save(updated)

        const reloaded = await repo.findById('usr-contract-1')
        expect(reloaded?.roles).toEqual(['warehouse_operator', 'dispatcher'])
        expect(reloaded?.active).toBe(false)

        const all = await repo.findAll()
        expect(all).toHaveLength(1)
      } finally {
        cleanup()
      }
    })
  })
}

runUserAccountRepositoryContractTests('InMemoryUserAccountRepository', () => ({
  repo: new InMemoryUserAccountRepository(),
  cleanup: () => {},
}))

runUserAccountRepositoryContractTests('DrizzleSqliteUserAccountRepository (:memory:)', () => {
  const driver = new DrizzleSqliteDriver(':memory:')
  return {
    repo: new DrizzleSqliteUserAccountRepository(driver),
    cleanup: () => driver.close(),
  }
})

describe('ScryptPasswordHasherAdapter', () => {
  it('hashes with unique random salts and verifies timing-safely', async () => {
    const hasher = new ScryptPasswordHasherAdapter()
    const hashA = await hasher.hash('hexlogix-demo')
    const hashB = await hasher.hash('hexlogix-demo')

    expect(hashA).not.toBe(hashB)
    expect(await hasher.verify(hashA, 'hexlogix-demo')).toBe(true)
    expect(await hasher.verify(hashB, 'hexlogix-demo')).toBe(true)
    expect(await hasher.verify(hashA, 'wrong-password')).toBe(false)
    expect(await hasher.verify('malformed-hash', 'hexlogix-demo')).toBe(false)
  })
})
