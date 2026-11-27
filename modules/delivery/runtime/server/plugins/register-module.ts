import { defineNitroPlugin } from 'nitropack/runtime'
import { registerDeliveryModuleMetadata } from '../utils/delivery-container'

export default defineNitroPlugin(() => {
  registerDeliveryModuleMetadata()
})
