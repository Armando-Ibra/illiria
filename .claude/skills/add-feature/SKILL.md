---
name: add-feature
description: Add an organization-scoped feature (entity, endpoints, validation, migration, tests, web client types) to the Illiria API following the Projects reference feature. Use when asked to add a new resource, endpoint group or CRUD to the backend.
---

# Add an organization-scoped feature

Reference implementation: `src/Illiria.Api/Features/Projects/`. Copy its shape, don't invent a new one.

1. **Entity** — `Features/<Feature>/<Entity>.cs`: `sealed class` implementing `IOrganizationScoped`
   (`Guid OrganizationId { get; set; }`), `Guid Id = Guid.CreateVersion7()`, timestamps as `DateTimeOffset`.
   Add an `internal sealed class <Entity>Configuration : IEntityTypeConfiguration<Entity>` with `ToTable("<plural_snake_case>")`,
   max lengths, and an FK to `Organization` with cascade delete. Don't add a `DbSet`; use `db.Set<Entity>()`.
   If the entity is truly not org-owned, mark it `[GlobalEntity("why")]` instead and filter every query explicitly.
2. **Endpoints** — `Features/<Feature>/<Feature>Endpoints.cs`: `endpoints.MapOrganizationScope().MapGroup("/<plural>")`,
   `.WithTags(...)`, `.WithName(...)` per endpoint, `TypedResults`, `.RequireOrganizationRole(OrganizationRole.Admin)`
   for destructive or admin actions. Request/response `record`s and `AbstractValidator<T>` validators in the same
   folder; attach with `.WithValidation<TRequest>()`. Never filter by `OrganizationId` by hand.
3. **Wire up** — call `app.Map<Feature>Endpoints()` in `Program.cs`.
4. **Migration** — follow the `add-migration` skill.
5. **Tests** — in `tests/Illiria.Api.IntegrationTests/<Feature>Tests.cs` (`[Collection(MultiTenantCollection.Name)]`,
   `ResetAsync()` in `InitializeAsync`): happy path, validation 400, role 403 where relevant, and an isolation test
   proving another organization gets 404 by id (copy `ProjectTests.Another_organizations_projects_are_invisible_even_by_id`).
6. **Contract** — `cd web && npm run api:gen` and commit `src/Illiria.Api/openapi/illiria.json` + `web/src/api/schema.d.ts`.
7. **Verify** — `dotnet build Illiria.slnx` (warnings are errors) and `dotnet test Illiria.slnx`.
