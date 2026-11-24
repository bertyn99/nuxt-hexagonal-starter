export type ClockMode = 'system' | 'virtual'

export interface ClockPort {
  readonly mode: ClockMode
  now(): Date
  isoNow(): string
}

export interface ControllableClockPort extends ClockPort {
  advanceByMs(ms: number): Date
  advanceByHours(hours: number): Date
  reset(): Date
  setNow(date: Date): Date
  getOffsetMs(): number
}
