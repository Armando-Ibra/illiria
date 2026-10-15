# Provenance

Illiria's code is written for this repository. These MIT-licensed projects informed its design;
if code is ever copied from them, keep their copyright notice next to it.

| Source | What we took | What we deliberately did differently |
|---|---|---|
| [fullstackhero/dotnet-starter-kit](https://github.com/fullstackhero/dotnet-starter-kit) | Tenant isolation on by default in the DbContext plus an architecture test for it; migrations as a separate deploy step; production fail-fast on missing config; AGENTS.md as the single AI guide | Tenant from the route + membership check (no header override); named filters only, bare `IgnoreQueryFilters()` banned by a test; Identity cookies instead of hand-rolled JWT in localStorage; one web app; one VM instead of Terraform |
| [jasontaylordev/CleanArchitecture](https://github.com/jasontaylordev/CleanArchitecture) | ASP.NET Core Identity API endpoints with cookies; Respawn to reset the database between tests; generated client from OpenAPI | One project instead of four layers; no MediatR/AutoMapper (now commercial) |
| [ardalis/CleanArchitecture](https://github.com/ardalis/CleanArchitecture) | Single-project "MinimalClean" shape; Testcontainers integration tests; xUnit v3 | No FastEndpoints (Minimal APIs are enough); no Specification/Result libraries yet |
