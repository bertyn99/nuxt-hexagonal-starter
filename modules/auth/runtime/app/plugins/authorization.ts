export default defineNuxtPlugin(() => {
  const { user } = useUserSession()

  return {
    provide: {
      authorization: {
        resolveClientUser: async <User extends Record<string, unknown>>() => {
          return (user.value as unknown as User | null) ?? null
        },
      },
    },
  }
})
