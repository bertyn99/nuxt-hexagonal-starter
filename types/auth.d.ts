import type { RoleDto } from '../modules/auth/shared/types/auth'

declare module '#auth-utils' {
  interface User {
    id: string
    email: string
    name: string
    roles: RoleDto[]
    active: boolean
  }

  interface UserSession {
    loggedInAt?: string
  }
}

export {}
