export interface UseCase<TInput, TOutput> {
  readonly name: string
  readonly boundedContext: string
  execute(input: TInput): Promise<TOutput>
}
