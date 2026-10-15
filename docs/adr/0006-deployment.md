# 0006 — Deployment: one VM, Docker Compose, Caddy

Status: accepted · 2026-10-15

## Decision
- Production = one VM running `deploy/compose.yml`: `web` (Caddy: TLS via ACME, static SPA, `/api` reverse proxy),
  `api`, `migrate`, `postgres`.
- **Migrations are a separate step**: the API image accepts a `migrate` verb (`dotnet Illiria.Api.dll migrate`).
  Same image and configuration as the API (no second config to drift); `api` starts only after `migrate` succeeds.
  The API never migrates at startup.
- Production fails fast without its required configuration (`ProductionGuard`).
- The API trusts `X-Forwarded-*` only from Caddy's fixed Docker network.
- Daily `pg_dump` with retention and optional off-site copy (`deploy/backup.sh`, rclone); restore documented and tested.
- CI builds both images; on `main` it pushes them to GHCR.

## Consequences
Cheap (one small VM) and simple to operate. Scaling out (managed Postgres, more API replicas, a PaaS) is a later
change of hosting, not of code: the API is stateless apart from Postgres.
