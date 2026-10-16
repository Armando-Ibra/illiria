# 0001 — Scope and principles

Status: accepted · 2026-10-15

## Context
We build several small SaaS products (B2B and B2C) with a small team. Existing starters were evaluated:
FullStackHero (modular monolith, 10 modules, two React apps, Terraform), jasontaylordev/CleanArchitecture
(4-project Clean Architecture, MediatR, Identity) and ardalis/CleanArchitecture (Core/UseCases/Infrastructure/Web,
FastEndpoints, plus a single-project "MinimalClean" variant). All three are MIT-licensed.
FullStackHero in particular showed what a broad starter costs: features (chat, wallet, webhooks) outgrew the
depth of the core (auth, tenant isolation), and the docs drifted from the code.

## Decision
Illiria is a thin, opinionated starter grown from real products:
- **Extract, don't invent.** A capability enters the starter only after a product needed it.
- **Framework first.** Prefer what ASP.NET Core / EF Core / Identity already do over custom code
  (less code we own = fewer security fixes we owe).
- **Fail closed.** Missing configuration stops startup; missing organization context returns no data.
- **Every rule has a test.** Conventions that matter are enforced by tests (architecture, tenancy), not only by docs.
- **One way to do things.** One API project, one web app, one deployment target.

v0.1 scope: auth (Identity, cookies), organizations with Single/Multi tenancy, members and invitations,
one sample feature (Projects), email over SMTP, health, rate limiting, OpenAPI with a generated TS client,
CI, single-VM deploy with backups. Everything else is in [0008](0008-deferred.md).

## Consequences
We own every line: dependency updates (Dependabot) and security fixes are on us, so the surface stays small.
