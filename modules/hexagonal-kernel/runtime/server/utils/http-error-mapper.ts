import { createError, EvlogError, useLogger } from 'evlog'
import type { AuditableLogger } from 'evlog'
import { getRouterParam, readBody } from 'h3'
import type { H3Event } from 'h3'
import type { z } from 'zod'
import { DomainError } from '../../../core/domain/domain-error'
import type { DomainErrorStatusHint } from '../../../core/domain/domain-error'

const STATUS_MAP: Record<DomainErrorStatusHint, number> = {
  validation: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  unavailable: 503,
}

export interface DomainErrorGuidance {
  readonly title: string
  readonly fix: string
}

/**
 * Dynamic error-guidance registry.
 * Each bounded context registers its own domain error codes at module boot so
 * hexagonal-kernel stays 100% domain-agnostic when example contexts are removed.
 */
const domainErrorGuidanceRegistry = new Map<string, DomainErrorGuidance>([
  [
    'UNAUTHORIZED',
    {
      title: 'Authentication required',
      fix: 'Sign in at /login or switch to a demo persona in the sidebar/Inspector.',
    },
  ],
  [
    'FORBIDDEN',
    {
      title: 'Insufficient permissions',
      fix: 'Sign in with an account that holds the required role or permission for this action.',
    },
  ],
])

export function registerDomainErrorGuidance(entries: Record<string, DomainErrorGuidance>): void {
  for (const [code, guidance] of Object.entries(entries)) {
    domainErrorGuidanceRegistry.set(code, guidance)
  }
}

const DEFAULT_GUIDANCE_BY_HINT: Record<DomainErrorStatusHint, DomainErrorGuidance> = {
  validation: {
    title: 'Invalid domain input',
    fix: 'Check the submitted values and try again.',
  },
  unauthorized: {
    title: 'Authentication required',
    fix: 'Sign in to continue.',
  },
  forbidden: {
    title: 'Action forbidden by domain policy',
    fix: 'Verify that the required permissions or preconditions are met.',
  },
  not_found: {
    title: 'Requested resource not found',
    fix: 'Verify the resource identifier and try again.',
  },
  conflict: {
    title: 'Domain rule violation',
    fix: 'Review the current resource state and adjust the request.',
  },
  unavailable: {
    title: 'Dependent service temporarily unavailable',
    fix: 'Retry the request shortly once the downstream service is healthy.',
  },
}

export function getRequestLogger(event?: H3Event): AuditableLogger | null {
  if (!event) {
    return null
  }
  try {
    return useLogger(event)
  } catch {
    return null
  }
}

export function mapDomainErrorToHttp(error: unknown, event?: H3Event): never {
  const logger = getRequestLogger(event)

  if (error instanceof DomainError) {
    const status = STATUS_MAP[error.statusHint] ?? 400
    const guidance =
      domainErrorGuidanceRegistry.get(error.code) ?? DEFAULT_GUIDANCE_BY_HINT[error.statusHint]

    logger?.error(error, {
      domain: {
        code: error.code,
        statusHint: error.statusHint,
        details: error.details,
      },
    })

    throw createError({
      code: error.code,
      message: guidance.title,
      status,
      why: error.message,
      fix: guidance.fix,
      cause: error,
      data: {
        code: error.code,
        statusHint: error.statusHint,
        details: error.details,
      },
    })
  }

  if (EvlogError.isEvlogError(error)) {
    logger?.error(error, {
      errorCode: error.code,
    })
    throw error
  }

  if (error && typeof error === 'object' && ('statusCode' in error || 'status' in error)) {
    if (error instanceof Error) {
      logger?.error(error)
    }
    throw error
  }

  const originalError = error instanceof Error ? error : new Error(String(error))
  logger?.error(originalError, { step: 'unhandled' })

  throw createError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Unexpected server error',
    status: 500,
    why: 'An unhandled error occurred while processing the request',
    fix: 'Retry the request or inspect server logs if the problem persists',
    cause: originalError,
    internal: {
      originalMessage: originalError.message,
    },
  })
}

export function requireRouterParam(event: H3Event, paramName: string, label?: string): string {
  const value = getRouterParam(event, paramName)
  if (!value || value.trim().length === 0) {
    const fieldLabel = label ?? paramName
    throw createError({
      code: 'MISSING_ROUTE_PARAM',
      message: `Missing ${fieldLabel} parameter`,
      status: 400,
      why: `Route parameter "${paramName}" is required for this endpoint`,
      fix: `Provide a valid "${paramName}" in the request URL path`,
    })
  }
  return value
}

export async function parseBodyWithSchema<TSchema extends z.ZodTypeAny>(
  event: H3Event,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  const rawBody = await readBody(event)
  const parsed = schema.safeParse(rawBody)
  if (!parsed.success) {
    const logger = getRequestLogger(event)
    const fields = parsed.error.issues.map(issue => issue.path.join('.') || 'body')
    const why = parsed.error.issues
      .map(issue => `${issue.path.join('.') || 'body'}: ${issue.message}`)
      .join('; ')

    logger?.set({
      validation: {
        issueCount: parsed.error.issues.length,
        fields,
      },
    })

    throw createError({
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      status: 422,
      why,
      fix: 'Check the invalid request fields and submit values matching the schema',
      data: {
        code: 'VALIDATION_ERROR',
        issues: parsed.error.issues,
      },
    })
  }
  return parsed.data
}
