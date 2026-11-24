import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { useHexagonalKernel } from '../../utils/hexagonal-kernel'
import { parseBodyWithSchema } from '../../utils/http-error-mapper'

const clockActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('advance'),
    hours: z.number().positive().max(720),
  }),
  z.object({
    action: z.literal('reset'),
  }),
])

export default defineEventHandler(async (event) => {
  const kernel = useHexagonalKernel()
  if (!kernel.controllableClock) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Virtual clock is not active. Set hexagonal.clock = "virtual" in nuxt.config.ts.',
      data: { code: 'CLOCK_NOT_CONTROLLABLE' },
    })
  }

  const body = await parseBodyWithSchema(event, clockActionSchema)
  if (body.action === 'advance') {
    kernel.controllableClock.advanceByHours(body.hours)
  }
  else {
    kernel.controllableClock.reset()
  }

  return await kernel.getInspectorSnapshot()
})
