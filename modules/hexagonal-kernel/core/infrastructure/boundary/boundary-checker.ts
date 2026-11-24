import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, posix, relative, resolve } from 'node:path'

export interface BoundaryViolation {
  readonly rule: 'DOMAIN_PURITY' | 'APPLICATION_ISOLATION' | 'CROSS_CONTEXT_ISOLATION'
  readonly file: string
  readonly importSpecifier: string
  readonly message: string
}

const FORBIDDEN_CORE_PACKAGES = [
  'nuxt',
  '@nuxt/',
  'nitro',
  'nitropack',
  'h3',
  'vue',
  'vue-router',
  'drizzle-orm',
  'better-sqlite3',
  'zod',
  '#imports',
  '#app',
  '#nitro',
  '#internal',
  'node:',
]

const IMPORT_REGEX = /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g

function toPosix(p: string): string {
  return p.split('\\').join('/')
}

function walkTsFiles(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) {
    return acc
  }
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === '.nuxt' || entry === '.output') {
        continue
      }
      walkTsFiles(full, acc)
    }
    else if (/\.(ts|mts|cts|vue)$/.test(entry) && !entry.endsWith('.d.ts')) {
      acc.push(full)
    }
  }
  return acc
}

export function extractImportSpecifiers(source: string): string[] {
  // Strip single-line and multi-line comments to avoid false positives in comments/JSDoc
  const cleaned = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
  const imports: string[] = []
  let match: RegExpExecArray | null
  while ((match = IMPORT_REGEX.exec(cleaned)) !== null) {
    const spec = match[1] ?? match[2]
    if (spec) {
      imports.push(spec)
    }
  }
  return imports
}

function isForbiddenPackage(spec: string): boolean {
  return FORBIDDEN_CORE_PACKAGES.some(pkg =>
    pkg.endsWith('/') || pkg.endsWith(':')
      ? spec.startsWith(pkg)
      : spec === pkg || spec.startsWith(`${pkg}/`),
  )
}

function resolveImportToRepoRelative(rootDir: string, filePath: string, spec: string): string | null {
  if (spec.startsWith('.')) {
    const abs = resolve(dirname(filePath), spec)
    return toPosix(relative(rootDir, abs))
  }
  if (spec.startsWith('~~/') || spec.startsWith('@@/')) {
    return spec.slice(3)
  }
  if (spec.startsWith('~/') || spec.startsWith('@/')) {
    return `app/${spec.slice(2)}`
  }
  return null
}

function parseModuleLayer(relPath: string): { moduleName: string, layer: string } | null {
  const match = relPath.match(/^modules\/([^/]+)\/(.+)$/)
  if (!match) {
    return null
  }
  const moduleName = match[1]!
  const rest = match[2]!
  if (rest === 'core/domain' || rest.startsWith('core/domain/')) {
    return { moduleName, layer: 'domain' }
  }
  if (rest === 'core/application' || rest.startsWith('core/application/')) {
    return { moduleName, layer: 'application' }
  }
  if (rest === 'core/infrastructure' || rest.startsWith('core/infrastructure/')) {
    return { moduleName, layer: 'infrastructure' }
  }
  if (rest === 'shared' || rest.startsWith('shared/')) {
    return { moduleName, layer: 'shared' }
  }
  if (rest === 'runtime/server' || rest.startsWith('runtime/server/')) {
    return { moduleName, layer: 'runtime-server' }
  }
  if (rest === 'runtime/app' || rest.startsWith('runtime/app/')) {
    return { moduleName, layer: 'runtime-app' }
  }
  return { moduleName, layer: 'root' }
}

export function checkHexagonalBoundaries(rootDir: string): BoundaryViolation[] {
  const modulesDir = resolve(rootDir, 'modules')
  const files = walkTsFiles(modulesDir)
  const violations: BoundaryViolation[] = []

  for (const file of files) {
    const relFile = toPosix(relative(rootDir, file))
    const owner = parseModuleLayer(relFile)
    if (!owner) {
      continue
    }

    const content = readFileSync(file, 'utf8')
    const specifiers = extractImportSpecifiers(content)

    for (const spec of specifiers) {
      const resolvedTarget = resolveImportToRepoRelative(rootDir, file, spec)
      const normalizedTarget = resolvedTarget ? posix.normalize(resolvedTarget) : null

      // Rule 1a: Domain Purity
      if (owner.layer === 'domain') {
        if (isForbiddenPackage(spec) || !spec.startsWith('.')) {
          violations.push({
            rule: 'DOMAIN_PURITY',
            file: relFile,
            importSpecifier: spec,
            message: `Pure domain file "${relFile}" must not import external or framework specifier "${spec}".`,
          })
          continue
        }
        if (normalizedTarget) {
          const targetInfo = parseModuleLayer(normalizedTarget)
          const isSameModuleDomain = targetInfo?.moduleName === owner.moduleName && targetInfo.layer === 'domain'
          const isKernelDomain = targetInfo?.moduleName === 'hexagonal-kernel' && targetInfo.layer === 'domain'
          if (!isSameModuleDomain && !isKernelDomain) {
            violations.push({
              rule: 'DOMAIN_PURITY',
              file: relFile,
              importSpecifier: spec,
              message: `Pure domain file "${relFile}" cannot import "${normalizedTarget}". Only own core/domain/ or hexagonal-kernel/core/domain/ are allowed.`,
            })
          }
        }
        continue
      }

      // Rule 1b: Application Isolation
      if (owner.layer === 'application') {
        if (isForbiddenPackage(spec) || !spec.startsWith('.')) {
          violations.push({
            rule: 'APPLICATION_ISOLATION',
            file: relFile,
            importSpecifier: spec,
            message: `Application file "${relFile}" must not depend on framework/external specifier "${spec}".`,
          })
          continue
        }
        if (normalizedTarget) {
          const targetInfo = parseModuleLayer(normalizedTarget)
          const isOwnCore = targetInfo?.moduleName === owner.moduleName
            && (targetInfo.layer === 'domain' || targetInfo.layer === 'application')
          const isKernelCore = targetInfo?.moduleName === 'hexagonal-kernel'
            && (targetInfo.layer === 'domain' || targetInfo.layer === 'application')
          if (!isOwnCore && !isKernelCore) {
            violations.push({
              rule: 'APPLICATION_ISOLATION',
              file: relFile,
              importSpecifier: spec,
              message: `Application file "${relFile}" cannot import "${normalizedTarget}". Only own core/{domain,application} or hexagonal-kernel/core/{domain,application} are allowed.`,
            })
          }
        }
        continue
      }

      // Rule 2: Cross-Context Isolation (applies to every layer of non-kernel bounded contexts)
      if (owner.moduleName !== 'hexagonal-kernel' && normalizedTarget) {
        const targetInfo = parseModuleLayer(normalizedTarget)
        if (
          targetInfo
          && targetInfo.moduleName !== owner.moduleName
          && targetInfo.moduleName !== 'hexagonal-kernel'
        ) {
          // Cross-context modules must NEVER import another context's core/domain or core/infrastructure
          if (targetInfo.layer === 'domain' || targetInfo.layer === 'infrastructure') {
            violations.push({
              rule: 'CROSS_CONTEXT_ISOLATION',
              file: relFile,
              importSpecifier: spec,
              message: `Bounded context "${owner.moduleName}" (${relFile}) cannot import "${targetInfo.moduleName}/${targetInfo.layer}" ("${normalizedTarget}"). Use an Anti-Corruption Layer port + public application facade or Domain Events instead.`,
            })
          }
        }
      }
    }
  }

  return violations
}
