export abstract class Entity<TId extends string = string> {
  readonly id: TId

  protected constructor(id: TId) {
    if (!id || id.trim().length === 0) {
      throw new Error('Entity id cannot be empty.')
    }
    this.id = id
  }

  equals(other?: Entity<TId> | null): boolean {
    if (!other) {
      return false
    }
    if (this === other) {
      return true
    }
    return this.id === other.id
  }
}
