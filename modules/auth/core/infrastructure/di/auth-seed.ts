import type { ClockPort } from '../../../../hexagonal-kernel/core/application/ports/clock.port'
import type { Role } from '../../../../hexagonal-kernel/core/domain/actor'
import type { PasswordHasherPort } from '../../application/ports/outbound/password-hasher.port'
import type { UserAccountRepositoryPort } from '../../application/ports/outbound/user-account-repository.port'
import { UserAccount } from '../../domain/entities/user-account'

export const DEMO_ACCOUNT_PASSWORD = 'hexlogix-demo'

interface DemoSeedUser {
  readonly id: string
  readonly email: string
  readonly name: string
  readonly roles: readonly Role[]
}

export const DEMO_PERSONAS: readonly DemoSeedUser[] = [
  {
    id: 'usr-admin',
    email: 'admin@hexlogix.dev',
    name: 'Elena Rostova',
    roles: ['admin'],
  },
  {
    id: 'usr-warehouse',
    email: 'warehouse@hexlogix.dev',
    name: 'Marcus Vance',
    roles: ['warehouse_operator'],
  },
  {
    id: 'usr-dispatcher',
    email: 'dispatcher@hexlogix.dev',
    name: 'Sora Takahashi',
    roles: ['dispatcher'],
  },
  {
    id: 'usr-viewer',
    email: 'viewer@hexlogix.dev',
    name: 'Alex Mercer',
    roles: ['viewer'],
  },
]

export async function seedDemoUsersIfEmpty(
  userRepository: UserAccountRepositoryPort,
  passwordHasher: PasswordHasherPort,
  clock: ClockPort,
): Promise<void> {
  const existing = await userRepository.findAll()
  if (existing.length > 0) {
    return
  }

  const now = clock.now()

  for (const [index, persona] of DEMO_PERSONAS.entries()) {
    const passwordHash = await passwordHasher.hash(DEMO_ACCOUNT_PASSWORD)
    const account = UserAccount.create({
      id: persona.id,
      email: persona.email,
      name: persona.name,
      roles: persona.roles,
      passwordHash,
      now: new Date(now.getTime() + index * 1000),
    })
    await userRepository.save(account)
  }
}
