export const API_CACHE_KEYS = {
  authPersonas: 'auth:personas',
  warehouseBins: 'warehouse:bins',
  warehouseUtilization: 'warehouse:utilization',
  deliveryShipments: 'delivery:shipments',
  deliveryAvailableCargo: 'delivery:available-cargo',
  hexInspector: 'hex:inspector',
} as const

export function formatApiError(err: unknown, fallbackMessage: string) {
  const parsed = parseError(err)
  const code =
    parsed.code ??
    (typeof parsed.data?.code === 'string' ? parsed.data.code : 'DOMAIN_RULE_VIOLATION')
  const details = [
    parsed.why ?? parsed.message ?? fallbackMessage,
    parsed.fix ? `Fix: ${parsed.fix}` : null,
  ]
    .filter(Boolean)
    .join(' — ')
  return { parsed, code, details }
}
