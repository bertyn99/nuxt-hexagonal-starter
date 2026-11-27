import type { UserAccount } from '../../../domain/entities/user-account'

export interface UserAccountRepositoryPort {
  findById(id: string): Promise<UserAccount | null>
  findByEmail(email: string): Promise<UserAccount | null>
  findAll(): Promise<UserAccount[]>
  save(account: UserAccount): Promise<void>
}
