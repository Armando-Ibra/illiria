# Illiria: guide for coding agents

Full-stack SaaS starter. Read `docs/adr/` before changing a convention; update the ADR when you do.

## Map
- `src/Illiria.Api/Platform/` — identity (`User`, `AppUserManager`), tenancy (`Organization`, `Membership`,
  `Invitation`, `CurrentOrganization`, `OrganizationScope`), persistence (`AppDbContext`, migrations), email,
  HTTP (CSRF, security headers, validation), hosting (`ProductionGuard`, `MigrateCommand`).
- `src/Illiria.Api/Features/<Feature>/` — entity + EF configuration + records + validators + endpoints.
  `Features/Projects` is the reference feature to copy.
- `tests/Illiria.Api.Tests` (fast rules) · `tests/Illiria.Api.IntegrationTests` (real API + Postgres via Testcontainers).
- `web/` — React app; `web/src/api/schema.d.ts` is GENERATED from `src/Illiria.Api/openapi/illiria.json`.
- `deploy/` — compose, Dockerfiles, Caddyfile, backups.

## Commands
```bash
dotnet build Illiria.slnx
dotnet test Illiria.slnx                                   # needs Docker for integration tests
dotnet ef migrations add <Name> --project src/Illiria.Api --output-dir Platform/Persistence/Migrations
cd web && pnpm run api:gen                                  # after any API contract change
cd web && pnpm run lint && pnpm run typecheck && pnpm run build
cd web && pnpm run test:e2e        # Playwright vs the REAL API: start it first with Identity__RequireConfirmedEmail=false
```

## Rules (each one is tested or checked in CI)
1. **Org data is reachable only through `MapOrganizationScope()`** (`/api/orgs/{orgId}/...`). Never read the
   organization from a header, query string or claim.
2. **Org-owned entities implement `IOrganizationScoped`**; anything else needs `[GlobalEntity("reason")]`.
   Don't filter by `OrganizationId` by hand in scoped endpoints; the DbContext does it.
3. **Never call `IgnoreQueryFilters()` without filter names.** It removes tenant isolation.
4. `Platform` never references `Features`; features never reference each other (shared code goes to `Platform`).
5. Every request body has a FluentValidation validator and `.WithValidation<T>()`.
6. Return `TypedResults` (the OpenAPI document and the web client are generated from them).
7. Every model change ships with a migration; every API contract change ships with regenerated
   `openapi/illiria.json` and `web/src/api/schema.d.ts`.
8. State-changing requests need the `X-CSRF: 1` header (the web client adds it). Don't add CORS.
9. Secrets never go in `appsettings*.json` committed files, except local-dev defaults in `appsettings.Development.json`.
10. Structured logging only (`[LoggerMessage]` or message templates), never string interpolation in log calls.
11. Propagate `CancellationToken` to every EF/IO call.

## Style
C#: file-scoped namespaces, `sealed` by default, records for DTOs, primary constructors, nullable on,
warnings are errors. TS: strict, no `any`, server state only through TanStack Query.

## Adding things
- Backend feature: skill `.claude/skills/add-feature/SKILL.md`.
- Migration: skill `.claude/skills/add-migration/SKILL.md`.
- Web page / component conventions: `web/README.md`.
