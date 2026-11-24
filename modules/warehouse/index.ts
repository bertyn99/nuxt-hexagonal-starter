import {
  addComponentsDir,
  addImportsDir,
  addServerScanDir,
  createResolver,
  defineNuxtModule,
  extendPages,
} from '@nuxt/kit'

export default defineNuxtModule({
  meta: {
    name: 'warehouse',
  },
  setup(_options, nuxt) {
    const { resolve } = createResolver(import.meta.url)

    // 1. Auto-register Nitro API routes (/api/warehouse/*) & server container facade
    addServerScanDir(resolve('./runtime/server'))

    // 2. Register prefixed UI components (<WarehouseBinCard>, <WarehouseReceiveCargoModal>)
    addComponentsDir({
      path: resolve('./runtime/app/components'),
      prefix: 'Warehouse',
    })

    // 3. Register composable (useWarehouse)
    addImportsDir(resolve('./runtime/app/composables'))

    // 4. Register module-owned /warehouse page
    extendPages((pages) => {
      pages.push({
        name: 'warehouse',
        path: '/warehouse',
        file: resolve('./runtime/app/pages/warehouse/index.vue'),
      })
    })

    // 5. Include shared/ DTOs & Zod schemas in shared TypeScript context (app + server)
    nuxt.options.typescript.sharedTsConfig ??= {}
    nuxt.options.typescript.sharedTsConfig.include ??= []
    nuxt.options.typescript.sharedTsConfig.include.push(resolve('./shared/**/*'))
  },
})
