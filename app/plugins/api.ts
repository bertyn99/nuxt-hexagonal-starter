export default defineNuxtPlugin(() => {
  const api = $fetch.create({
    onResponseError({ request, options, response }) {
      if (!import.meta.client) {
        return
      }
      const parsed = parseError({
        status: response.status,
        statusCode: response.status,
        statusMessage: response.statusText,
        data: response._data,
      })
      log.error({
        action: 'api_request_failed',
        method: options.method ?? 'GET',
        url: typeof request === 'string' ? request : request.url,
        status: response.status,
        code: parsed.code,
        why: parsed.why ?? parsed.message,
      })
    },
  })

  return {
    provide: {
      api,
    },
  }
})
