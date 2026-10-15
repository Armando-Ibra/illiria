---
name: add-migration
description: Create, review and verify an EF Core migration for the Illiria API after a model change. Use when entities or their configuration changed, or when CI reports pending model changes.
---

# Add an EF Core migration

1. `dotnet tool restore` (once).
2. `dotnet ef migrations add <PascalCaseName> --project src/Illiria.Api --output-dir Platform/Persistence/Migrations`
3. Review the generated `Up`/`Down`:
   - snake_case table and column names (naming convention is on; set `ToTable` for new entities);
   - org-scoped tables have `organization_id` with an index and an FK to `organizations`;
   - deploys swap containers while the old API still runs: prefer additive changes (new nullable column,
     backfill, then tighten in a later migration). Never rename or drop in the same release that stops using it.
4. `dotnet ef migrations has-pending-model-changes --project src/Illiria.Api` must say there are no changes.
5. `dotnet test Illiria.slnx` — integration tests apply all migrations to a fresh Postgres.
6. Production applies it through the `migrate` service (`deploy/compose.yml`); never migrate from the API at startup.
