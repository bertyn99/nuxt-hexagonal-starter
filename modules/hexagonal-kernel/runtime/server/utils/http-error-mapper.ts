import { createError, EvlogError, useLogger } from 'evlog'
import type { AuditableLogger } from 'evlog'
import { getRouterParam, readBody } from 'h3'
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

interface DomainErrorGuidance {
  readonly title: string
  readonly fix: string
}

const DOMAIN_ERROR_GUIDANCE: Record<string, DomainErrorGuidance> = {
  INCOMPATIBLE_STORAGE_ZONE: {
    title: 'Storage zone incompatible with cargo handling class',
    fix: 'Choose a warehouse bin whose storage zone matches the cargo handling requirements.',
  },
  BIN_CAPACITY_EXCEEDED: {
    title: 'Warehouse bin capacity exceeded',
    fix: 'Select another bin with enough remaining weight/volume capacity or split the cargo.',
  },
  CARGO_NOT_FOUND_IN_BIN: {
    title: 'Cargo unit not found',
    fix: 'Verify the cargo ID and refresh the warehouse inventory.',
  },
  CARGO_ALREADY_ALLOCATED: {
    title: 'Cargo unit already allocated',
    fix: 'Choose an unallocated cargo unit or cancel the existing shipment first.',
  },
  WAREHOUSE_BIN_NOT_FOUND: {
    title: 'Warehouse bin not found',
    fix: 'Verify the bin ID against the current list of warehouse bins.',
  },
  DUPLICATE_CARGO_UNIT: {
    title: 'Duplicate cargo unit',
    fix: 'Use a unique cargo identifier or inspect the existing unit in the bin.',
  },
  INVALID_STATE_TRANSITION: {
    title: 'Invalid shipment state transition',
    fix: 'Check the current shipment state and perform an allowed lifecycle transition.',
  },
  CANNOT_CANCEL_DISPATCHED_SHIPMENT: {
    title: 'Cannot cancel dispatched shipment',
    fix: 'Only shipments in PendingDispatch can be cancelled. Record a delivery exception instead.',
  },
  SHIPMENT_NOT_FOUND: {
    title: 'Shipment not found',
    fix: 'Verify the shipment ID and refresh the deliveries list.',
  },
  CARRIER_HANDLING_NOT_SUPPORTED: {
    title: 'Carrier does not support cargo handling class',
    fix: 'Select a carrier mode that supports this cargo handling class (e.g. COLD_CHAIN_COURIER for cold chain).',
  },
  CARRIER_GATEWAY_UNAVAILABLE: {
    title: 'Carrier gateway unavailable',
    fix: 'Disable simulated carrier outage in the Architecture Inspector or retry when the carrier recovers.',
  },
}

const DEFAULT_GUIDANCE_BY_HINT: Record<DomainErrorStatusHint, DomainErrorGuidance> = {
  validation: {
    title: 'Invalid domain input',
    fix: 'Check the submitted values and try again.',
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
  }
  catch {
    return null
  }
}

export function mapDomainErrorToHttp(error: unknown, event?: H3Event): never {
  const logger = getRequestLogger(event)

  if (error instanceof DomainError) {
    const status = STATUS_MAP[error.statusHint] ?? 400
    const guidance = DOMAIN_ERROR_GUIDANCE[error.code] ?? DEFAULT_GUIDANCE_BY_HINT[error.statusHint]

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
