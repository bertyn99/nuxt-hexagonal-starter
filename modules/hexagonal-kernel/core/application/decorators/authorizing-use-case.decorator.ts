import { ANONYMOUS_ACTOR, isAuthenticatedActor } from '../../domain/actor'
import type { Actor } from '../../domain/actor'
import { ForbiddenError, UnauthorizedError } from '../../domain/domain-error'
import type { ExecutionContext, UseCase } from '../use-case'

export type AccessPolicy<TInput = unknown> = (actor: Actor, input: TInput) => boolean

export interface AuthorizationPolicySpec<TInput = unknown> {
  readonly policyName: string
  readonly requiredRolesDescription: string
  readonly check: AccessPolicy<TInput>
  readonly allowAnonymous?: boolean
}

/**
 * Application-layer Use Case Decorator enforcing pure domain RBAC/ABAC policies.
 * Composed inside TracingUseCaseDecorator so authorization rejections (401/403)
 * are automatically captured in Architecture Inspector call traces.
 */
export class AuthorizingUseCaseDecorator<TInput, TOutput> implements UseCase<TInput, TOutput> {
  readonly name: string
  readonly boundedContext: string

  constructor(
    private readonly inner: UseCase<TInput, TOutput>,
    private readonly spec: AuthorizationPolicySpec<TInput>,
  ) {
    this.name = inner.name
    this.boundedContext = inner.boundedContext
  }

  async execute(input: TInput, ctx?: ExecutionContext): Promise<TOutput> {
    const actor = ctx?.actor ?? ANONYMOUS_ACTOR

    if (!this.spec.allowAnonymous && !isAuthenticatedActor(actor)) {
      throw new UnauthorizedError(`Authentication required to execute ${this.inner.name}`, {
        useCase: this.inner.name,
        policy: this.spec.policyName,
      })
    }

    if (!this.spec.check(actor, input)) {
      throw new ForbiddenError(
        `Actor "${actor.email || actor.id}" lacks permission for "${this.spec.policyName}" (requires: ${this.spec.requiredRolesDescription})`,
        {
          useCase: this.inner.name,
          policy: this.spec.policyName,
          actorId: actor.id,
          actorRoles: [...actor.roles],
          required: this.spec.requiredRolesDescription,
        },
      )
    }

    return this.inner.execute(input, ctx)
  }
}
