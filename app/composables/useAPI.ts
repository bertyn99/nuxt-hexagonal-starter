export const useAPI = createUseFetch(callerOptions => ({
  $fetch: useNuxtApp().$api as typeof $fetch,
  getCachedData(key, nuxtApp, ctx) {
    if (ctx.cause === 'refresh:manual' || ctx.cause === 'refresh:hook' || ctx.cause === 'watch') {
      return undefined
    }
    return nuxtApp.payload.data[key] ?? nuxtApp.static.data[key]
  },
  ...callerOptions,
}))
