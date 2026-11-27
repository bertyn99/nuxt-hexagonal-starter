import type { UseCase } from '../../../../hexagonal-kernel/core/application/use-case'
import { InvalidCredentialsError } from '../../domain/errors/auth.errors'
import { mapUserAccountToView } from '../dtos/auth.dtos'
import type { AuthUserView } from '../dtos/auth.dtos'
import type { PasswordHasherPort } from '../ports/outbound/password-hasher.port'
import type { UserAccountRepositoryPort } from '../ports/outbound/user-account-repository.port'

export interface AuthenticateUserInput {
  readonly email: string
  readonly password: string
}

/**
 * Syntactically valid scrypt placeholder hash used when an email is not found,
 * ensuring password verification still runs to mitigate user-enumeration timing oracles.
 */
const DUMMY_PASSWORD_HASH = 'scrypt:00000000000000000000000000000000:' + '00'.repeat(64)

export class AuthenticateUserUseCase implements UseCase<AuthenticateUserInput, AuthUserView> {
  readonly name = 'AuthenticateUserUseCase'
  readonly boundedContext = 'auth'

  constructor(
    private readonly userRepository: UserAccountRepositoryPort,
    private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(input: AuthenticateUserInput): Promise<AuthUserView> {
    const normalizedEmail = input.email.trim().toLowerCase()
    const account = await this.userRepository.findByEmail(normalizedEmail)
    if (!account) {
      await this.passwordHasher.verify(DUMMY_PASSWORD_HASH, input.password)
      throw new InvalidCredentialsError()
    }

    const validPassword = await this.passwordHasher.verify(account.passwordHash, input.password)
    if (!validPassword) {
      throw new InvalidCredentialsError()
    }

    account.assertCanAuthenticate()
    return mapUserAccountToView(account)
  }
}
