import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { useHexagonalKernel } from '../../utils/hexagonal-kernel'
import { parseBodyWithSchema } from '../../utils/http-error-mapper'

const faultUpdateSchema = z.object({
  outageEnabled: z.boolean().optional(),
  extraDelayHours: z.number().min(0).max(168).optional(),
})

export default defineEventHandler(async (event) => {
  const kernel = useHexagonalKernel()
  const body = await parseBodyWithSchema(event, faultUpdateSchema)

  if (typeof body.outageEnabled === 'boolean') {
    kernel.faultState.outageEnabled = body.outageEnabled
  }
  if (typeof body.extraDelayHours === 'number') {
    kernel.faultState.extraDelayHours = body.extraDelayHours
  }

  return await kernel.getInspectorSnapshot()
})
