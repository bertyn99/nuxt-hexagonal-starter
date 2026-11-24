import type { ClockMode, ControllableClockPort } from '../../application/ports/clock.port'

export class VirtualClockAdapter implements ControllableClockPort {
  readonly mode: ClockMode = 'virtual'
  private offsetMs = 0
  private fixedTimeMs: number | null

  constructor(initialDate?: Date) {
    this.fixedTimeMs = initialDate ? initialDate.getTime() : null
  }

  now(): Date {
    const baseMs = this.fixedTimeMs ?? Date.now()
    return new Date(baseMs + this.offsetMs)
  }

  isoNow(): string {
    return this.now().toISOString()
  }

  advanceByMs(ms: number): Date {
    this.offsetMs += ms
    return this.now()
  }

  advanceByHours(hours: number): Date {
    return this.advanceByMs(hours * 60 * 60 * 1000)
  }

  reset(): Date {
    this.offsetMs = 0
    return this.now()
  }

  setNow(date: Date): Date {
    this.fixedTimeMs = date.getTime()
    this.offsetMs = 0
    return this.now()
  }

  getOffsetMs(): number {
    return this.offsetMs
  }
}
