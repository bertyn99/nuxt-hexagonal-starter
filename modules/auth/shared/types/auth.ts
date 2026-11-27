export type RoleDto = 'admin' | 'warehouse_operator' | 'dispatcher' | 'viewer'

export interface AuthUserDto {
  id: string
  email: string
  name: string
  roles: RoleDto[]
  active: boolean
}

export interface AuthSessionDto {
  authenticated: boolean
  user: AuthUserDto | null
  demoMode: boolean
}
