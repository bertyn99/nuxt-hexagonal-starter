<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const router = useRouter()
const { isOpen: isInspectorOpen, snapshot, open: openInspector, advanceClock, evaluateSlas } = useHexInspector()
const { bins, ensureBinsLoaded } = useWarehouse()
const { shipments, ensureShipmentsLoaded } = useDeliveries()

const searchOpen = shallowRef(false)

watch(searchOpen, (isOpen) => {
  if (!isOpen) {
    return
  }
  Promise.all([ensureBinsLoaded(), ensureShipmentsLoaded()]).catch(() => {
    // Error details are logged centrally by $api's onResponseError hook
  })
})

const navItems: NavigationMenuItem[][] = [
  [
    {
      label: 'Overview',
      icon: 'i-lucide-layout-dashboard',
      to: '/',
    },
    {
      label: 'Warehouse',
      icon: 'i-lucide-warehouse',
      to: '/warehouse',
      badge: 'WMS',
    },
    {
      label: 'Deliveries',
      icon: 'i-lucide-truck',
      to: '/deliveries',
      badge: 'TMS',
    },
  ],
  [
    {
      label: 'Inspector',
      icon: 'i-lucide-microscope',
      onSelect: () => openInspector(),
    },
  ],
]

const searchGroups = computed(() => [
  {
    id: 'navigation',
    label: 'Bounded Contexts',
    items: [
      {
        id: 'nav-overview',
        label: 'Operations Overview',
        suffix: 'Host Shell',
        icon: 'i-lucide-layout-dashboard',
        onSelect: () => router.push('/'),
      },
      {
        id: 'nav-warehouse',
        label: 'Warehouse Storage (WMS)',
        suffix: 'modules/warehouse',
        icon: 'i-lucide-warehouse',
        onSelect: () => router.push('/warehouse'),
      },
      {
        id: 'nav-deliveries',
        label: 'Delivery & Dispatch (TMS)',
        suffix: 'modules/delivery',
        icon: 'i-lucide-truck',
        onSelect: () => router.push('/deliveries'),
      },
    ],
  },
  {
    id: 'bins',
    label: 'Warehouse Bins',
    items: bins.value.map(bin => ({
      id: `bin-${bin.id}`,
      label: `${bin.code} (${bin.zone})`,
      suffix: `${bin.utilizationPercent}% used • ${bin.cargoCount} unit(s)`,
      icon: 'i-lucide-box',
      onSelect: () => router.push('/warehouse'),
    })),
  },
  {
    id: 'shipments',
    label: 'Shipments',
    items: shipments.value.map(s => ({
      id: `shp-${s.id}`,
      label: `${s.trackingNumber} — ${s.destination}`,
      suffix: `${s.state}${s.slaBreached ? ' • SLA BREACHED' : ''}`,
      icon: 'i-lucide-package-check',
      onSelect: () => router.push('/deliveries'),
    })),
  },
  {
    id: 'actions',
    label: 'Hexagonal Quick Actions',
    items: [
      {
        id: 'act-inspector',
        label: 'Open Architecture Inspector',
        icon: 'i-lucide-microscope',
        onSelect: () => openInspector(),
      },
      {
        id: 'act-clock-12h',
        label: 'Virtual Clock: Advance +12 hours',
        icon: 'i-lucide-fast-forward',
        onSelect: async () => {
          await advanceClock(12)
        },
      },
      {
        id: 'act-sla',
        label: 'Evaluate Delivery SLAs Now',
        icon: 'i-lucide-radar',
        onSelect: async () => {
          await evaluateSlas()
        },
      },
    ],
  },
])
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      id="hex-sidebar"
      collapsible
      resizable
      class="bg-elevated/30"
    >
      <template #header="{ collapsed }">
        <NuxtLink to="/" class="flex items-center gap-2.5 px-1 py-1">
          <div class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-inverted shadow-xs">
            <UIcon name="i-lucide-hexagon" class="size-4.5" />
          </div>
          <div v-if="!collapsed" class="min-w-0">
            <p class="truncate text-sm font-semibold tracking-tight text-highlighted">
              HexLogix
            </p>
            <p class="truncate text-[11px] text-muted">
              WMS + TMS Telemetry
            </p>
          </div>
        </NuxtLink>
      </template>

      <template #default="{ collapsed }">
        <UDashboardSearchButton :collapsed="collapsed" class="mb-2" />

        <UNavigationMenu
          :collapsed="collapsed"
          :items="navItems[0]"
          orientation="vertical"
        />

        <USeparator class="my-3" />

        <UNavigationMenu
          :collapsed="collapsed"
          :items="navItems[1]"
          orientation="vertical"
        />
      </template>

      <template #footer="{ collapsed }">
        <div class="flex items-center justify-between gap-2 w-full">
          <UColorModeButton size="xs" />
          <div v-if="!collapsed" class="flex items-center gap-1.5 min-w-0">
            <UBadge
              v-if="snapshot?.faults.outageEnabled"
              color="error"
              variant="soft"
              size="xs"
            >
              Carrier Outage
            </UBadge>
            <UBadge
              v-else-if="(snapshot?.clock.offsetHours ?? 0) > 0"
              color="warning"
              variant="soft"
              size="xs"
            >
              +{{ snapshot?.clock.offsetHours }}h Clock
            </UBadge>
            <UBadge
              v-else
              color="neutral"
              variant="subtle"
              size="xs"
            >
              Ports & Adapters
            </UBadge>
          </div>
        </div>
      </template>
    </UDashboardSidebar>

    <UDashboardSearch v-model:open="searchOpen" :groups="searchGroups" />

    <slot />

    <LazyHexInspectorDrawer v-if="isInspectorOpen" />
  </UDashboardGroup>
</template>
