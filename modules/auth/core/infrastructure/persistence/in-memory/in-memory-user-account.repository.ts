import type { UserAccountRepositoryPort } from '../../../application/ports/outbound/user-account-repository.port'
import { UserAccount } from '../../../domain/entities/user-account'

export class InMemoryUserAccountRepository implements UserAccountRepositoryPort {
  private readonly store = new Map<string, ReturnType<UserAccount['toSnapshot']>>()

  async findById(id: string): Promise<UserAccount | null> {
    const snap = this.store.get(id)
    return snap ? UserAccount.rehydrate(snap) : null
  }

  async findByEmail(email: string): Promise<UserAccount | null> {
    const normalized = email.trim().toLowerCase()
    for (const snap of this.store.values()) {
      if (snap.email === normalized) {
        return UserAccount.rehydrate(snap)
      }
    }
    return null
  }

  async findAll(): Promise<UserAccount[]> {
    return Array.from(this.store.values()).map(snap => UserAccount.rehydrate(snap))
  }

  async save(account: UserAccount): Promise<void> {
    this.store.set(account.id, account.toSnapshot())
  }
}
