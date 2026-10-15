# 0002 — One API project, organized by feature

Status: accepted · 2026-10-15

## Decision
- `src/Illiria.Api` is the only backend project (like ardalis' MinimalClean). Split into projects/modules only
  when a product really has independent bounded contexts.
- `Platform/` holds cross-cutting code: identity, tenancy, persistence, email, HTTP plumbing, hosting.
- `Features/<Feature>/` holds a feature's entity, EF configuration, request/response records, validators and
  Minimal API endpoints, usually in one or two files.
- Rules (enforced by `tests/Illiria.Api.Tests/ArchitectureTests.cs`):
  `Platform` never depends on `Features`; a feature never depends on another feature.
- Minimal APIs with `TypedResults`; FluentValidation through `.WithValidation<T>()`; ProblemDetails for errors.
- **No mediator, no repositories, no AutoMapper.** Handlers are static methods that use `AppDbContext` directly;
  mapping is a `ToDto` function. (MediatR and AutoMapper are now commercially licensed; Mediator (MIT) can be
  added later if a cross-cutting pipeline is really needed.)
- One `AppDbContext` (snake_case naming on Postgres). Feature entities register through
  `IEntityTypeConfiguration<T>`; features use `db.Set<T>()`.

## Consequences
Less ceremony per feature; the price is discipline on boundaries, which the architecture tests keep.
