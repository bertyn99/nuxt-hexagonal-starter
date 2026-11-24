export default defineNuxtConfig({
  modules: [
    '@nuxt/ui',
    '@nuxt/eslint',
  ],

  // Local modules in modules/*/index.ts are auto-discovered by Nuxt 4:
  // - modules/hexagonal-kernel/
  // - modules/warehouse/
  // - modules/delivery/
  hexagonal: {
    persistence: 'drizzle-sqlite', // 'in-memory' | 'drizzle-sqlite'
    carrier: 'simulated', // 'simulated' | 'webhook-console'
    clock: 'virtual', // 'system' | 'virtual'
    inspector: true,
    sqlitePath: '.data/logistics.sqlite',
  },

  devtools: { enabled: false },

  telemetry: false,

  css: ['~/assets/css/main.css'],

  compatibilityDate: '2025-07-15',

  typescript: {
    strict: true,
    typeCheck: false,
  },
})
