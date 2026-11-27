import type { UseCase } from '../../../../hexagonal-kernel/core/application/use-case'
import { UserNotFoundError } from '../../domain/errors/auth.errors'
import { mapUserAccountToView } from '../dtos/auth.dtos'
import type { AuthUserView } from '../dtos/auth.dtos'
import type { UserAccountRepositoryPort } from '../ports/outbound/user-account-repository.port'

export interface ResolveUserByIdInput {
  readonly userId: string
}

export class ResolveUserByIdQuery implements UseCase<ResolveUserByIdInput, AuthUserView> {
  readonly name = 'ResolveUserByIdQuery'
  readonly boundedContext = 'auth'

  constructor(private readonly userRepository: UserAccountRepositoryPort) {}

  async execute(input: ResolveUserByIdInput): Promise<AuthUserView> {
    const account = await this.userRepository.findById(input.userId)
    if (!account) {
      throw new UserNotFoundError(input.userId)
    }
    account.assertCanAuthenticate()
    return mapUserAccountToView(account)
  }
}
