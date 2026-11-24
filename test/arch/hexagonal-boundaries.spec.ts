import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkHexagonalBoundaries } from '../../modules/hexagonal-kernel/core/infrastructure/boundary/boundary-checker'

const REPO_ROOT = resolve(import.meta.dirname, '../..')

describe('Hexagonal & Modular Monolith Architectural Boundaries', () => {
  it('enforces zero boundary violations across all modules in this repository', () => {
    const violations = checkHexagonalBoundaries(REPO_ROOT)
    expect(violations).toEqual([])
  })

  it('catches forbidden framework imports inside core/domain/ and cross-context domain leaks', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'hex-arch-test-'))
    try {
      mkdirSync(join(tempRoot, 'modules/warehouse/core/domain'), { recursive: true })
      mkdirSync(join(tempRoot, 'modules/delivery/core/domain'), { recursive: true })
      mkdirSync(join(tempRoot, 'modules/delivery/core/application'), { recursive: true })

      // Violation 1: Framework import inside pure domain
      writeFileSync(
        join(tempRoot, 'modules/warehouse/core/domain/bad-entity.ts'),
        `import { z } from 'zod'\nexport const x = z.string()\n`,
      )

      // Violation 2: Cross-context import from delivery -> warehouse/core/domain
      writeFileSync(
        join(tempRoot, 'modules/delivery/core/application/leaky-use-case.ts'),
        `import { WarehouseBin } from '../../../warehouse/core/domain/entities/warehouse-bin'\nexport const y = WarehouseBin\n`,
      )

      const violations = checkHexagonalBoundaries(tempRoot)
      const rules = violations.map(v => v.rule)

      expect(rules).toContain('DOMAIN_PURITY')
      expect(rules).toContain('APPLICATION_ISOLATION')
    } finally {
      rmSync(tempRoot, { recursive: true, force: true })
    }
  })
})
