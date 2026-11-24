import { defineEventHandler } from 'h3'
import { useHexagonalKernel } from '../../utils/hexagonal-kernel'

export default defineEventHandler(async () => {
  const kernel = useHexagonalKernel()
  return await kernel.getInspectorSnapshot()
})
