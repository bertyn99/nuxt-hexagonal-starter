import { ValidationDomainError } from '../../../../hexagonal-kernel/core/domain/domain-error'
import type { HandlingClass } from '../../../../hexagonal-kernel/core/domain/handling-class'

export const STORAGE_ZONES = ['AMBIENT', 'COLD_CHAIN', 'HAZMAT'] as const
export type StorageZone = (typeof STORAGE_ZONES)[number]

export function assertStorageZone(value: string): StorageZone {
  if (!(STORAGE_ZONES as readonly string[]).includes(value)) {
    throw new ValidationDomainError(
      'INVALID_STORAGE_ZONE',
      `Invalid storage zone "${value}". Expected one of: ${STORAGE_ZONES.join(', ')}.`,
      { value },
    )
  }
  return value as StorageZone
}

/**
 * Storage zone compatibility matrix:
 * - AMBIENT: STANDARD, FRAGILE (rejects COLD_CHAIN and HAZMAT)
 * - COLD_CHAIN: COLD_CHAIN, STANDARD, FRAGILE (rejects HAZMAT)
 * - HAZMAT: HAZMAT only (strict hazardous isolation)
 */
const ALLOWED_HANDLING_BY_ZONE: Record<StorageZone, readonly HandlingClass[]> = {
  AMBIENT: ['STANDARD', 'FRAGILE'],
  COLD_CHAIN: ['COLD_CHAIN', 'STANDARD', 'FRAGILE'],
  HAZMAT: ['HAZMAT'],
}

export function isHandlingCompatibleWithZone(
  zone: StorageZone,
  handlingClass: HandlingClass,
): boolean {
  return ALLOWED_HANDLING_BY_ZONE[zone].includes(handlingClass)
}
