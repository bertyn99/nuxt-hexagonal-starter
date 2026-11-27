import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import type { PasswordHasherPort } from '../../application/ports/outbound/password-hasher.port'

const scryptAsync = promisify(scrypt)
const KEY_LENGTH = 64

/**
 * Driven adapter implementing PasswordHasherPort via Node's native crypto.scrypt.
 * Keeps password hashing deterministic across pure Node tests and Nitro server runtime
 * without coupling core/infrastructure to Nuxt's server auto-imports.
 */
export class ScryptPasswordHasherAdapter implements PasswordHasherPort {
  async hash(plainPassword: string): Promise<string> {
    const salt = randomBytes(16).toString('hex')
    const derived = (await scryptAsync(plainPassword, salt, KEY_LENGTH)) as Buffer
    return `scrypt:${salt}:${derived.toString('hex')}`
  }

  async verify(hashedPassword: string, plainPassword: string): Promise<boolean> {
    const parts = hashedPassword.split(':')
    if (parts.length !== 3 || parts[0] !== 'scrypt') {
      return false
    }
    const [, salt, storedHex] = parts
    if (!salt || !storedHex) {
      return false
    }
    const derived = (await scryptAsync(plainPassword, salt, KEY_LENGTH)) as Buffer
    const stored = Buffer.from(storedHex, 'hex')
    if (derived.length !== stored.length) {
      return false
    }
    return timingSafeEqual(derived, stored)
  }
}
