import { createError, readBody } from 'h3'
import type { H3Event } from 'h3'
import type { z } from 'zod'
import { DomainError } from '../../../core/domain/domain-error'
import type { DomainErrorStatusHint } from '../../../core/domain/domain-error'

const STATUS_MAP: Record<DomainErrorStatusHint, number> = {
  validation: 400,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  unavailable: 503,
}

export function mapDomainErrorToHttp(error: unknown): never {
  if (error instanceof DomainError) {
    const statusCode = STATUS_MAP[error.statusHint] ?? 400
    throw createError({
      statusCode,
      statusMessage: error.message,
      data: {
        code: error.code,
        statusHint: error.statusHint,
        details: error.details,
      },
    })
  }

  if (error && typeof error === 'object' && 'statusCode' in error) {
    throw error
  }

  const message = error instanceof Error ? error.message : 'Unexpected server error'
  throw createError({
    statusCode: 500,
    statusMessage: message,
    data: {
      code: 'INTERNAL_SERVER_ERROR',
    },
  })
}

export async function parseBodyWithSchema<TSchema extends z.ZodTypeAny>(
  event: H3Event,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  const rawBody = await readBody(event)
  const parsed = schema.safeParse(rawBody)
  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Request validation failed',
      data: {
        code: 'VALIDATION_ERROR',
        issues: parsed.error.issues,
      },
    })
  }
  return parsed.data
}
