import type { Actor } from '../domain/actor'

export interface ExecutionContext {
  readonly actor: Actor
  readonly correlationId?: string
}

export interface UseCase<TInput, TOutput> {
  readonly name: string
  readonly boundedContext: string
  execute(input: TInput, ctx?: ExecutionContext): Promise<TOutput>
}
