# Illiria

A small, opinionated full-stack SaaS starter: **ASP.NET Core 10 + EF Core + Postgres** API and a
**React + Vite + shadcn/ui (Base UI)** web app, deployed with **Docker Compose on one VM**.
Multi-tenant (organizations) or single-tenant with the same code.

What's in v0.1: registration, email confirmation, login with HttpOnly cookies, password reset, 2FA endpoints,
organizations with Owner/Admin/Member roles, invitations, a sample org-scoped feature (Projects), SMTP email,
rate limiting, health checks, OpenAPI with a generated TypeScript client, CI, backups.
What's not (yet), and when it will be: [docs/adr/0008-deferred.md](docs/adr/0008-deferred.md).

## Run it locally

Prerequisites: .NET SDK 10, Node 22, Docker.

```bash
docker compose -f deploy/compose.dev.yml up -d        # Postgres + Mailpit (emails at http://localhost:8025)
dotnet tool restore
dotnet run --project src/Illiria.Api -- migrate        # apply migrations
dotnet run --project src/Illiria.Api                   # API on http://localhost:5080 (Scalar at /scalar)
cd web && npm install && npm run dev                   # web app on http://localhost:5173
```

Register at http://localhost:5173, confirm the email from Mailpit, log in.
Tenancy mode: `Tenancy:Mode` in `src/Illiria.Api/appsettings.json` (`Multi` or `Single`).

## Tests

```bash
dotnet test Illiria.slnx          # unit + architecture + integration (integration needs Docker)
cd web && npm run lint && npm run typecheck && npm run build
```

## Layout

| Path | What |
|---|---|
| `src/Illiria.Api/Platform` | Identity, tenancy, persistence, email, HTTP plumbing, hosting |
| `src/Illiria.Api/Features` | One folder per feature: entity, endpoints, validators |
| `tests/` | Architecture/unit tests, integration tests (Testcontainers) |
| `web/` | React app ([web/README.md](web/README.md)) |
| `deploy/` | Dockerfiles, Caddyfile, compose files, backups ([deploy/README.md](deploy/README.md)) |
| `docs/adr` | Architecture decisions: read these before changing a convention |

## Working with AI agents

[AGENTS.md](AGENTS.md) is the guide for all coding agents; `CLAUDE.md` imports it, and Claude Code skills live in
`.claude/skills/` (`add-feature`, `add-migration`).
