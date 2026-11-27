import type { UseCase } from '../../../../hexagonal-kernel/core/application/use-case'
import { mapUserAccountToView } from '../dtos/auth.dtos'
import type { AuthUserView } from '../dtos/auth.dtos'
import type { UserAccountRepositoryPort } from '../ports/outbound/user-account-repository.port'

export class ListDemoPersonasQuery implements UseCase<void, AuthUserView[]> {
  readonly name = 'ListDemoPersonasQuery'
  readonly boundedContext = 'auth'

  constructor(private readonly userRepository: UserAccountRepositoryPort) {}

  async execute(): Promise<AuthUserView[]> {
    const accounts = await this.userRepository.findAll()
    return accounts.filter(account => account.active).map(mapUserAccountToView)
  }
}
