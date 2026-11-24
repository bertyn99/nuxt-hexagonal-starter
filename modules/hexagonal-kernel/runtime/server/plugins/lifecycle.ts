import { defineNitroPlugin } from 'nitropack/runtime'
import { shutdownHexagonalKernel, useHexagonalKernel } from '../utils/hexagonal-kernel'

export default defineNitroPlugin((nitroApp) => {
  // Eagerly boot the kernel so SQLite schema and audit subscribers are ready immediately
  useHexagonalKernel()

  nitroApp.hooks.hook('close', () => {
    shutdownHexagonalKernel()
  })
})
