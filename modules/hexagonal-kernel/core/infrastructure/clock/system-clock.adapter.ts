import type { ClockMode, ClockPort } from '../../application/ports/clock.port'

export class SystemClockAdapter implements ClockPort {
  readonly mode: ClockMode = 'system'

  now(): Date {
    return new Date()
  }

  isoNow(): string {
    return this.now().toISOString()
  }
}
