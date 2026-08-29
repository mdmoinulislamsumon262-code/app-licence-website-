# DeviceGuard License Manager

DeviceGuard lets an app owner review Android app installations, approve scoped licenses, and control access from a protected admin dashboard.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/deviceguard run dev` — run the web dashboard
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `SESSION_SECRET`, `DEVICEGUARD_ADMIN_USERNAME`, `DEVICEGUARD_ADMIN_PASSWORD`
- Optional env: `DEVICEGUARD_ADMIN_USERNAME` (defaults to `admin`)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/deviceguard` — React/Vite admin dashboard
- `artifacts/api-server` — Express API, authentication, device handshake, and access actions
- `lib/db/src/schema/deviceguard.ts` — PostgreSQL schema
- `lib/api-spec/openapi.yaml` — API contract source of truth

## Architecture decisions

- The dashboard uses bearer sessions while the device handshake and license validation remain public for Android clients.
- A registration is unique per `app_id` + installation `device_id`, allowing several apps on one device.
- Approved handshakes issue an HMAC-signed license token. `/api/device/validate` checks the token and the current database status before an app enables protected features.
- Requested permissions are stored separately from granted permissions; approval only grants the checked scopes.
- Device IDs are stored alongside a SHA-256 hash and should be app-scoped installation UUIDs, not hardware identifiers.
- PostgreSQL and Drizzle replace the original local SQLite file so the app persists across restarts and deployments.
- The admin password is stored only as a Replit secret and is hashed before it reaches the database.

## Product

The dashboard supports admin login, app/device search and filtering, approval durations, per-permission grants, blocking, deletion, live counts, and recent activity logs. Android clients use `POST /api/device/handshake` to register and check access, then `POST /api/device/validate` before protected features.

## User preferences

The interface and user-facing copy are primarily in English with Bengali access-status messages preserved from the supplied implementation.

## Gotchas

- The first API-server start creates the configured admin account from environment variables; changing the secret later does not change an existing hash automatically.
- Run API codegen after changing `lib/api-spec/openapi.yaml`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
