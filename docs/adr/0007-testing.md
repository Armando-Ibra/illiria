# 0007 — Testing strategy

Status: accepted · 2026-10-15

## Decision
- `tests/Illiria.Api.Tests`: architecture rules (NetArchTest), tenancy model rules, `AppDbContext` scope enforcement.
  Fast, no Docker.
- `tests/Illiria.Api.IntegrationTests`: the real API (`WebApplicationFactory`) on real Postgres (Testcontainers),
  database reset between tests with Respawn, emails captured in memory. Flows are tested end to end through HTTP,
  including the email links (confirm, reset, invitation).
- Web: lint + typecheck + build in CI; Playwright tests against the **real** API (no route mocks: mocked e2e tests
  can't catch contract drift), reading the emails the API sends from Mailpit's HTTP API (registration, password
  reset, invitations, 2FA with real TOTP codes). CI runs them in multi-tenant and single-tenant mode.
- CI also fails when migrations don't match the model, when the OpenAPI document is stale, or when the web
  client types don't match the document.

## Consequences
Integration tests need Docker (available on GitHub-hosted runners and locally with Docker Desktop/Engine).
