// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

const FORBIDDEN_CORE_PACKAGES = [
  'nuxt',
  '@nuxt/*',
  'nitro',
  'nitropack',
  'nitropack/*',
  'h3',
  'vue',
  'vue-router',
  'drizzle-orm',
  'drizzle-orm/*',
  'better-sqlite3',
  'zod',
  '#imports',
  '#app',
  '#nitro',
  'node:*',
]

export default withNuxt(
  {
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },
  // Layer 3 Enforcement: Pure Domain Purity
  {
    files: ['modules/*/core/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: FORBIDDEN_CORE_PACKAGES,
            message: 'Hexagonal Domain Purity: core/domain/ must be pure TypeScript with zero framework, DB, validation, or Node imports.',
          },
          {
            group: ['**/core/infrastructure/**', '**/core/application/**', '**/runtime/**', '**/shared/**'],
            message: 'Hexagonal Dependency Rule: core/domain/ cannot depend on application, infrastructure, shared, or runtime layers.',
          },
        ],
      }],
    },
  },
  // Layer 3 Enforcement: Application Isolation
  {
    files: ['modules/*/core/application/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: FORBIDDEN_CORE_PACKAGES,
            message: 'Hexagonal Application Isolation: core/application/ must not depend on framework, DB, or validation libraries.',
          },
          {
            group: ['**/core/infrastructure/**', '**/runtime/**', '**/shared/**'],
            message: 'Hexagonal Dependency Rule: core/application/ can only depend on core/domain/ and hexagonal-kernel/core/.',
          },
        ],
      }],
    },
  },
  // Layer 3 Enforcement: Cross-Context Isolation (Delivery -> Warehouse)
  {
    files: ['modules/delivery/**/*.{ts,vue}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['**/warehouse/core/domain/**', '**/warehouse/core/infrastructure/**'],
            message: 'Modular Monolith Isolation: delivery must NEVER import warehouse/core/domain or warehouse/core/infrastructure. Use WarehouseStockPort ACL or Domain Events.',
          },
        ],
      }],
    },
  },
  // Layer 3 Enforcement: Cross-Context Isolation (Warehouse -> Delivery)
  {
    files: ['modules/warehouse/**/*.{ts,vue}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['**/delivery/core/domain/**', '**/delivery/core/infrastructure/**'],
            message: 'Modular Monolith Isolation: warehouse must NEVER import delivery/core/domain or delivery/core/infrastructure.',
          },
        ],
      }],
    },
  },
)
