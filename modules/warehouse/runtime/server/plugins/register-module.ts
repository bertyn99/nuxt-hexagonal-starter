import { defineNitroPlugin } from 'nitropack/runtime'
import { registerWarehouseModuleMetadata } from '../utils/warehouse-container'

export default defineNitroPlugin(() => {
  registerWarehouseModuleMetadata()
})
