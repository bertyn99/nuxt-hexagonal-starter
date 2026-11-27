import {
  addComponentsDir,
  addImportsDir,
  addServerScanDir,
  createResolver,
  defineNuxtModule,
  useLogger,
} from '@nuxt/kit'
import { checkHexagonalBoundaries } from './core/infrastructure/boundary/boundary-checker'
import type { HexagonalOptionsDto } from './shared/types/inspector'

export type HexagonalModuleOptions = Partial<HexagonalOptionsDto>

export default defineNuxtModule<HexagonalModuleOptions>({
  meta: {
    name: 'hexagonal-kernel',
    configKey: 'hexagonal',
  },
  defaults: {
    persistence: 'drizzle-sqlite',
    carrier: 'simulated',
    clock: 'virtual',
    inspector: undefined,
    sqlitePath: '.data/logistics.sqlite',
  },
  setup(options, nuxt) {
    const logger = useLogger('hexagonal-kernel')
    const { resolve } = createResolver(import.meta.url)

    const resolvedConfig: HexagonalOptionsDto = {
      persistence: options.persistence ?? 'drizzle-sqlite',
      carrier: options.carrier ?? 'simulated',
      clock: options.clock ?? 'virtual',
      inspector: options.inspector ?? process.env.NODE_ENV !== 'production',
      sqlitePath: options.sqlitePath ?? '.data/logistics.sqlite',
    }

    nuxt.options.runtimeConfig.hexagonal = {
      ...resolvedConfig,
      ...(nuxt.options.runtimeConfig.hexagonal as Record<string, unknown> | undefined),
    }

    nuxt.options.runtimeConfig.public.hexagonal = {
      inspector: resolvedConfig.inspector,
      clock: resolvedConfig.clock,
      persistence: resolvedConfig.persistence,
      carrier: resolvedConfig.carrier,
    }

    // 1. Register Nitro server routes, server utils, and lifecycle plugin
    addServerScanDir(resolve('./runtime/server'))

    // 2. Register prefixed Inspector UI components (<HexInspectorDrawer>, <HexCallTrace>, <HexClockControls>)
    addComponentsDir({
      path: resolve('./runtime/app/components'),
      prefix: 'Hex',
    })

    // 3. Register Inspector composable (useHexInspector)
    addImportsDir(resolve('./runtime/app/composables'))

    // 4. Expose shared/ types cleanly in both server and app TypeScript contexts
    nuxt.options.typescript.sharedTsConfig ??= {}
    nuxt.options.typescript.sharedTsConfig.include ??= []
    nuxt.options.typescript.sharedTsConfig.include.push(resolve('./shared/**/*'))

    // 5. Build/Dev-time Hexagonal & Modular Monolith Boundary Guard
    const runBoundaryCheck = () => {
      const violations = checkHexagonalBoundaries(nuxt.options.rootDir)
      if (violations.length > 0) {
        for (const v of violations) {
          logger.error(`[${v.rule}] ${v.message}`)
        }
        if (!nuxt.options.dev) {
          throw new Error(
            `Hexagonal architecture boundary check failed with ${violations.length} violation(s).`,
          )
        }
      } else {
        logger.info('Hexagonal & Modular Monolith boundaries verified (0 violations).')
      }
    }

    nuxt.hook('prepare:types', () => {
      runBoundaryCheck()
    })

    nuxt.hook('builder:watch', (_event, path) => {
      if (path.startsWith('modules/')) {
        runBoundaryCheck()
      }
    })
  },
})
