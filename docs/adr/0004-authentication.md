# 0004 — Authentication: ASP.NET Core Identity with cookies

Status: accepted · 2026-10-15

## Context
FullStackHero hand-rolls JWT + refresh tokens stored in `localStorage`, with gaps (one refresh token per user,
no server-side logout, 2FA re-enrollment without password). jasontaylordev uses the built-in Identity API endpoints.

## Decision
- `MapIdentityApi<User>()` under `/api/auth`: register, login, email confirmation, forgot/reset password, 2FA.
  The web app logs in with `?useCookies=true`: an **HttpOnly, Secure, SameSite=Lax** cookie. No token ever
  reaches JavaScript. `POST /api/auth/logout` ends the session.
- Same origin for web app and API (Caddy in production, Vite proxy in dev): no CORS.
- **CSRF**: every non-GET `/api` request must send `X-CSRF: 1` (a custom header needs same-origin script).
- Password ≥ 10 chars, lockout 5 attempts / 15 min, confirmed email required to log in.
- Security stamp validated every 5 minutes: a password change/reset invalidates other sessions within 5 minutes.
- **Data Protection keys in Postgres** (`data_protection_keys`): sessions survive restarts and deploys, and are
  part of database backups.
- Email links are built from `App:PublicUrl` and point at web app pages (`/confirm-email`, `/reset-password`,
  `/invitations/accept`), never at the request host.
- Rate limit policy `auth` on `/api/auth/*` (default 20/min per client IP; real IPs via trusted forwarded headers).

## Consequences
- Bearer tokens from the same endpoints remain possible later for a mobile client (`useCookies=false`).
- Social login, passkeys and SSO are deferred (0008); Identity supports them when needed.
