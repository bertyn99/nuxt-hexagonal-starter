# Swapping Auth to Better Auth (Hexagonal Adapter Guide)

This template ships with **`nuxt-auth-utils` + `nuxt-authorization`** as its working default (see [ADR-005](../adr/005-authentication-and-rbac-boundaries.md)) so that both `persistence: 'in-memory'` and `persistence: 'drizzle-sqlite'` boot with zero external auth setup.

When your application needs **database-backed sessions, OAuth/SSO providers, Passkeys, 2FA, or multi-tenant Organizations**, **[Better Auth](https://www.better-auth.com/)** is an excellent drop-in replacement.

Because all business logic depends strictly on the kernel's pure `Actor`, `ExecutionContext`, and per-context domain access policies, **swapping to Better Auth touches zero files in `hexagonal-kernel/core/`, `warehouse/core/`, or `delivery/core/`.**

---

## What Stays Untouched vs What Changes

| Layer                                            | Changes?      | Why                                                                                                                          |
| ------------------------------------------------ | ------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `modules/hexagonal-kernel/core/`                 | **No**        | `Actor`, `ExecutionContext`, `UnauthorizedError`, `ForbiddenError`, `AuthorizingUseCaseDecorator` are provider-agnostic.     |
| `modules/warehouse/` & `modules/delivery/`       | **No**        | Pure RBAC policies (`canReceiveWarehouseCargo`, `canCreateShipment`) and `AuthorizingUseCaseDecorator` only inspect `Actor`. |
| `modules/*/shared/abilities/`                    | **No**        | `nuxt-authorization` abilities wrap the pure domain policies and only depend on `resolveClientUser` / `resolveServerUser`.   |
| `modules/auth/core/infrastructure/` & `runtime/` | **Swap here** | Replace `nuxt-auth-utils` session handling with `better-auth`.                                                               |

---

## Step 1: Install Better Auth

```bash
pnpm add better-auth
pnpm remove nuxt-auth-utils
```

Remove `'nuxt-auth-utils'` from `modules` in `nuxt.config.ts` (you can keep `'nuxt-authorization'` so `<Can>` / `<Cannot>` continue working with zero template changes!).

---

## Step 2: Create the Better Auth Driven Adapter

Create `modules/auth/core/infrastructure/better-auth/auth-instance.ts`:

```ts
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin } from 'better-auth/plugins'
import type { DrizzleSqliteDriver } from '../../../../hexagonal-kernel/core/infrastructure/persistence/drizzle-sqlite-driver'
import * as authSchema from './better-auth.schema'

export function createBetterAuthInstance(driver: DrizzleSqliteDriver) {
  return betterAuth({
    database: drizzleAdapter(driver.db, {
      provider: 'sqlite',
      schema: authSchema,
    }),
    emailAndPassword: {
      enabled: true,
    },
    plugins: [
      admin({
        defaultRole: 'viewer',
      }),
    ],
  })
}
```

Generate Better Auth's Drizzle schema into `modules/auth/core/infrastructure/better-auth/better-auth.schema.ts`:

```bash
npx @better-auth/cli generate --output modules/auth/core/infrastructure/better-auth/better-auth.schema.ts
```

> **Boundary check:** Notice that `better-auth` is imported **only** inside `modules/auth/core/infrastructure/` and `modules/auth/runtime/`. Both `boundary-checker.ts` and `.oxlintrc.json` automatically block any accidental import of `better-auth` inside `core/domain/` or `core/application/`.

---

## Step 3: Mount Better Auth's Catch-All Nitro Route

Replace the manual `/api/auth/login.post.ts` and `/api/auth/logout.post.ts` handlers with a single Nitro catch-all driving adapter at `modules/auth/runtime/server/api/auth/[...all].ts`:

```ts
import { defineEventHandler, toWebRequest } from 'h3'
import { useBetterAuth } from '../../utils/better-auth'

export default defineEventHandler(event => {
  const auth = useBetterAuth()
  return auth.handler(toWebRequest(event))
})
```

---

## Step 4: Swap the Driving-Adapter Bridge (`auth-context.ts`)

This is the **single bridge** that maps Better Auth's session to the kernel's `Actor` value object in `modules/auth/runtime/server/utils/auth-context.ts`:

```ts
import { toWebRequest } from 'h3'
import type { H3Event } from 'h3'
import { ANONYMOUS_ACTOR, ROLES } from '../../../../hexagonal-kernel/core/domain/actor'
import type { Actor, Role } from '../../../../hexagonal-kernel/core/domain/actor'
import { useBetterAuth } from './better-auth'

function parseRoles(rawRole: string | null | undefined): Role[] {
  if (!rawRole) {
    return ['viewer']
  }
  const parsed = rawRole
    .split(',')
    .map(r => r.trim())
    .filter((r): r is Role => (ROLES as readonly string[]).includes(r))
  return parsed.length > 0 ? parsed : ['viewer']
}

export async function resolveAuthActorFromEvent(event: H3Event): Promise<Actor> {
  const auth = useBetterAuth()
  const session = await auth.api.getSession({
    headers: toWebRequest(event).headers,
  })

  if (!session?.user) {
    return ANONYMOUS_ACTOR
  }

  return Object.freeze({
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    roles: Object.freeze(parseRoles((session.user as { role?: string }).role)),
  })
}
```

---

## Step 5: Re-point the Kernel & `nuxt-authorization` Resolvers

1. **Server plugin** (`modules/auth/runtime/server/plugins/authorization.ts`) — registers the Better Auth actor resolver into `hexagonal-kernel` once at Nitro startup so **zero** routes in `hexagonal-kernel`, `warehouse`, or `delivery` ever need to change:

```ts
import { defineNitroPlugin } from 'nitropack/runtime'
import { isAuthenticatedActor } from '../../../../hexagonal-kernel/core/domain/actor'
import { registerActorResolver } from '../../../../hexagonal-kernel/runtime/server/utils/actor-context'
import { resolveAuthActorFromEvent } from '../utils/auth-context'

export default defineNitroPlugin(nitroApp => {
  registerActorResolver(resolveAuthActorFromEvent)

  nitroApp.hooks.hook('request', event => {
    event.context.$authorization = {
      resolveServerUser: async () => {
        const actor = await resolveAuthActorFromEvent(event)
        return isAuthenticatedActor(actor) ? (actor as unknown as Record<string, unknown>) : null
      },
    }
  })
})
```

2. **Client plugin** (`modules/auth/runtime/app/plugins/authorization.ts`) using `createAuthClient` from `better-auth/vue`:

```ts
import { createAuthClient } from 'better-auth/vue'
import { adminClient } from 'better-auth/client/plugins'

export default defineNuxtPlugin(() => {
  const authClient = createAuthClient({
    plugins: [adminClient()],
  })
  const session = authClient.useSession()

  return {
    provide: {
      authClient,
      authorization: {
        resolveClientUser: async () => {
          const user = session.value.data?.user
          if (!user) {
            return null
          }
          const roles = (user.role ?? 'viewer').split(',').map((r: string) => r.trim())
          return { id: user.id, email: user.email, name: user.name, roles }
        },
      },
    },
  }
})
```

---

## Step 6 (Optional): Using Better Auth's `accessControl` Plugin for Fine-Grained Org RBAC

If you adopt Better Auth's `organization` or `admin` `accessControl` statement map (`createAccessControl`), keep the hexagonal rule intact:

- Define your permission statements inside `modules/auth/core/infrastructure/better-auth/permissions.ts`.
- Translate Better Auth roles/permissions into the kernel's `Actor` inside `resolveActorFromEvent(event)`.
- Keep all business-rule authorization inside your bounded contexts' pure domain policies so `pnpm test:unit` remains `<100ms` with zero database or auth-framework boot.
