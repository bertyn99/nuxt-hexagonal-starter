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
    name: 'delivery',
  },
  setup(_options, nuxt) {
    const { resolve } = createResolver(import.meta.url)

    // 1. Auto-register Nitro API routes (/api/deliveries/*) & server container facade
    addServerScanDir(resolve('./runtime/server'))

    // 2. Register prefixed UI components (<DeliveryCreateShipmentModal>, <DeliveryTimelineSlideover>)
    addComponentsDir({
      path: resolve('./runtime/app/components'),
      prefix: 'Delivery',
    })

    // 3. Register composable (useDeliveries)
    addImportsDir(resolve('./runtime/app/composables'))

    // 4. Register module-owned /deliveries page
    extendPages(pages => {
      pages.push({
        name: 'deliveries',
        path: '/deliveries',
        file: resolve('./runtime/app/pages/deliveries/index.vue'),
      })
    })

    // 5. Include shared/ DTOs & Zod schemas in shared TypeScript context (app + server)
    nuxt.options.typescript.sharedTsConfig ??= {}
    nuxt.options.typescript.sharedTsConfig.include ??= []
    nuxt.options.typescript.sharedTsConfig.include.push(resolve('./shared/**/*'))
  },
})
