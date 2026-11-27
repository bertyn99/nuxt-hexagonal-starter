import { z } from 'zod'

export const loginRequestSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const switchPersonaRequestSchema = z.object({
  userId: z.string().trim().min(1, 'Persona userId is required'),
})

export type LoginRequestInput = z.infer<typeof loginRequestSchema>
export type SwitchPersonaRequestInput = z.infer<typeof switchPersonaRequestSchema>
