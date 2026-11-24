import { ValidationDomainError } from './domain-error'

export const HANDLING_CLASSES = ['STANDARD', 'FRAGILE', 'COLD_CHAIN', 'HAZMAT'] as const
export type HandlingClass = (typeof HANDLING_CLASSES)[number]

const HANDLING_SEVERITY: Record<HandlingClass, number> = {
  STANDARD: 0,
  FRAGILE: 1,
  COLD_CHAIN: 2,
  HAZMAT: 3,
}

export function assertHandlingClass(value: string): HandlingClass {
  if (!(HANDLING_CLASSES as readonly string[]).includes(value)) {
    throw new ValidationDomainError(
      'INVALID_HANDLING_CLASS',
      `Invalid handling class "${value}". Expected one of: ${HANDLING_CLASSES.join(', ')}.`,
      { value },
    )
  }
  return value as HandlingClass
}

export function strictestHandlingClass(classes: readonly HandlingClass[]): HandlingClass {
  if (classes.length === 0) {
    return 'STANDARD'
  }
  return classes.reduce<HandlingClass>((strictest, current) => {
    return HANDLING_SEVERITY[current] > HANDLING_SEVERITY[strictest] ? current : strictest
  }, 'STANDARD')
}

export function handlingClassSeverity(value: HandlingClass): number {
  return HANDLING_SEVERITY[value]
}
