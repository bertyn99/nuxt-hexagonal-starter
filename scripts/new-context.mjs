#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const rawName = process.argv[2]
if (!rawName || !/^[a-z][a-z0-9-]*$/.test(rawName)) {
  console.error('Usage: pnpm new:context <kebab-case-name> (e.g. pnpm new:context billing)')
  process.exit(1)
}

const rootDir = process.cwd()
const moduleDir = resolve(rootDir, 'modules', rawName)

if (existsSync(moduleDir)) {
  console.error(`Error: modules/${rawName} already exists.`)
  process.exit(1)
}

const pascal = rawName
  .split('-')
  .map(part => part.charAt(0).toUpperCase() + part.slice(1))
  .join('')

const camel = pascal.charAt(0).toLowerCase() + pascal.slice(1)

const dirs = [
  'core/domain/entities',
  'core/domain/errors',
  'core/domain/policies',
  'core/application/dtos',
  'core/application/ports/outbound',
  'core/application/use-cases',
  'core/infrastructure/di',
  'core/infrastructure/persistence/in-memory',
  'shared/abilities',
  'shared/schemas',
  'shared/types',
  'runtime/app/components',
  'runtime/app/composables',
  `runtime/app/pages/${rawName}`,
  `runtime/server/api/${rawName}`,
  'runtime/server/plugins',
  'runtime/server/utils',
]

for (const dir of dirs) {
  mkdirSync(resolve(moduleDir, dir), { recursive: true })
}

writeFileSync(
  resolve(moduleDir, 'index.ts'),
  `import {
  addComponentsDir,
  addImportsDir,
  addServerScanDir,
  createResolver,
  defineNuxtModule,
  extendPages,
} from '@nuxt/kit'

export default defineNuxtModule({
  meta: {
    name: '${rawName}',
  },
  setup(_options, nuxt) {
    const { resolve } = createResolver(import.meta.url)

    addServerScanDir(resolve('./runtime/server'))

    addComponentsDir({
      path: resolve('./runtime/app/components'),
      prefix: '${pascal}',
    })

    addImportsDir(resolve('./runtime/app/composables'))

    extendPages(pages => {
      pages.push({
        name: '${rawName}',
        path: '/${rawName}',
        file: resolve('./runtime/app/pages/${rawName}/index.vue'),
      })
    })

    nuxt.options.typescript.sharedTsConfig ??= {}
    nuxt.options.typescript.sharedTsConfig.include ??= []
    nuxt.options.typescript.sharedTsConfig.include.push(resolve('./shared/**/*'))
  },
})
`,
)

writeFileSync(
  resolve(moduleDir, `core/domain/policies/${rawName}-access.policy.ts`),
  `import { hasAnyRole } from '../../../../hexagonal-kernel/core/domain/actor'
import type { Actor } from '../../../../hexagonal-kernel/core/domain/actor'

export function canManage${pascal}(actor: Actor | null | undefined): boolean {
  return hasAnyRole(actor, ['admin'])
}
`,
)

writeFileSync(
  resolve(moduleDir, 'core/domain/index.ts'),
  `export * from './policies/${rawName}-access.policy'
`,
)

writeFileSync(
  resolve(moduleDir, `shared/abilities/${rawName}.abilities.ts`),
  `import { defineAbility } from 'nuxt-authorization/utils'
import type { Actor } from '../../../hexagonal-kernel/core/domain/actor'
import { canManage${pascal} } from '../../core/domain/policies/${rawName}-access.policy'

export const manage${pascal}Ability = defineAbility((user: Actor | null) => canManage${pascal}(user))
`,
)

writeFileSync(
  resolve(moduleDir, `runtime/app/pages/${rawName}/index.vue`),
  `<script setup lang="ts">
definePageMeta({
  title: '${pascal}',
})
</script>

<template>
  <UDashboardPanel id="${rawName}-panel" class="min-w-0">
    <template #header>
      <UDashboardNavbar title="${pascal}" icon="i-lucide-box">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mx-auto max-w-4xl">
        <UEmpty
          icon="i-lucide-hexagon"
          title="${pascal} Bounded Context"
          description="Scaffolded via pnpm new:context ${rawName}. Add domain entities, use cases, ports, and adapters under modules/${rawName}/."
        />
      </div>
    </template>
  </UDashboardPanel>
</template>
`,
)

writeFileSync(
  resolve(moduleDir, `runtime/server/utils/${rawName}-container.ts`),
  `import { useHexagonalKernel } from '../../../../hexagonal-kernel/runtime/server/utils/hexagonal-kernel'
import { registerDomainErrorGuidance } from '../../../../hexagonal-kernel/runtime/server/utils/http-error-mapper'

registerDomainErrorGuidance({
  // Register ${rawName}-specific DomainError codes here
})

let initialized = false

export function register${pascal}ModuleMetadata(): void {
  const kernel = useHexagonalKernel()
  kernel.registerModule({
    name: '${rawName}',
    boundedContext: '${pascal}',
    description: '${pascal} bounded context module.',
    persistenceAdapter: kernel.config.persistence,
    endpointsPrefix: '/api/${rawName}/*',
    pagePath: '/${rawName}',
  })
}

export function use${pascal}Module() {
  if (!initialized) {
    register${pascal}ModuleMetadata()
    initialized = true
  }
  return { name: '${camel}' }
}
`,
)

writeFileSync(
  resolve(moduleDir, 'runtime/server/plugins/register-module.ts'),
  `import { defineNitroPlugin } from 'nitropack/runtime'
import { register${pascal}ModuleMetadata } from '../utils/${rawName}-container'

export default defineNitroPlugin(() => {
  register${pascal}ModuleMetadata()
})
`,
)

console.log(`Scaffolded bounded context at modules/${rawName}/`)
console.log('Next steps:')
console.log(`  1. Add cross-context lint isolation rules for modules/${rawName}/ in .oxlintrc.json`)
console.log(`  2. Add /api/${rawName}/** route service mapping in nuxt.config.ts`)
console.log(`  3. Run pnpm typecheck && pnpm lint && pnpm test:arch`)
