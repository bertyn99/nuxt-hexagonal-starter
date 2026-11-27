import {
  addComponentsDir,
  addImportsDir,
  addPlugin,
  addServerScanDir,
  createResolver,
  defineNuxtModule,
  extendPages,
} from '@nuxt/kit'

export default defineNuxtModule({
  meta: {
    name: 'auth',
  },
  setup(_options, nuxt) {
    const { resolve } = createResolver(import.meta.url)

    // 1. Auto-register Nitro API routes (/api/auth/*), server utils, and authorization plugin
    addServerScanDir(resolve('./runtime/server'))

    // 2. Register client authorization resolver plugin (bridges nuxt-auth-utils -> nuxt-authorization)
    addPlugin(resolve('./runtime/app/plugins/authorization'))

    // 3. Register prefixed UI components (<AuthPersonaSwitcher>)
    addComponentsDir({
      path: resolve('./runtime/app/components'),
      prefix: 'Auth',
    })

    // 4. Register auth composables (useAuth, useAuthPersonas, formatRoleLabel)
    addImportsDir(resolve('./runtime/app/composables'))

    // 5. Register module-owned /login page
    extendPages(pages => {
      pages.push({
        name: 'login',
        path: '/login',
        file: resolve('./runtime/app/pages/login.vue'),
      })
    })

    // 6. Include shared/ DTOs & Zod schemas in shared TypeScript context (app + server)
    nuxt.options.typescript.sharedTsConfig ??= {}
    nuxt.options.typescript.sharedTsConfig.include ??= []
    nuxt.options.typescript.sharedTsConfig.include.push(resolve('./shared/**/*'))
  },
})
