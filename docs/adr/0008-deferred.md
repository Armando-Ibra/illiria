# 0008 — Deferred capabilities and their triggers

Status: accepted · 2026-10-15

Not in the starter until a product needs it. When it does, build it in that product, then extract it here.

| Capability | Trigger | Likely approach |
|---|---|---|
| Payments / subscriptions | first paid product | Stripe Checkout + Customer Portal + signed webhooks; subscription state per organization |
| Background jobs / outbox | email or work that must survive failures, schedules | `BackgroundService` + Postgres outbox table first; Hangfire (Postgres storage) if schedules grow |
| File uploads | user files | S3-compatible storage (Cloudflare R2), presigned URLs, per-organization prefixes |
| Realtime | live collaboration/notifications | SignalR, groups per organization |
| Observability | first production incident we couldn't explain from logs | OpenTelemetry → a hosted backend; Aspire dashboard in dev |
| Local orchestration | more than Postgres + Mailpit | .NET Aspire AppHost |
| Social login / SSO / passkeys | customer request | Identity external providers / passkeys |
| i18n | first non-English customer | request localization + resource files; web i18n library |
| Audit log | compliance or customer request | EF interceptor writing org-scoped audit entries |
| Admin / back-office | operating many customers | separate area with platform-level roles, never via tenant header tricks |
| Invitation resend | first support request about a lost invitation | revoke + invite again works today |
| Svelte frontend | a product that wants it | same generated OpenAPI contract |
