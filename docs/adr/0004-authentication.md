# 0004 — Authentication: ASP.NET Core Identity with cookies

Status: accepted · 2026-10-15

## Context
FullStackHero hand-rolls JWT + refresh tokens stored in `localStorage`, with gaps (one refresh token per user,
no server-side logout, 2FA re-enrollment without password). jasontaylordev uses the built-in Identity API endpoints.

## Decision
- `MapIdentityApi<User>()` under `/api/auth`: register, login, email confirmation, forgot/reset password, 2FA.
  The web app logs in with `?useCookies=true`: an **HttpOnly, Secure, SameSite=Lax** cookie. No token ever
  reaches JavaScript.
- **Server-side sessions** (`auth_sessions`, an `ITicketStore`): the cookie carries only a random session id.
  `POST /api/auth/logout` deletes the session, so a copied cookie stops working at once. Expired sessions are purged hourly.
- **Bearer tokens are disabled** (login without `useCookies=true` → 400, `/refresh` → 404): they can't be revoked on
  logout and no client needs them. Re-enable deliberately when a mobile client arrives.
- **Sensitive account changes need the current password**: 2FA changes and email changes require the
  `X-Current-Password` header (URL-encoded); password changes require `oldPassword`. A stolen session can't lock the
  owner out by enabling 2FA or moving the email.
- **Pre-registration defense**: someone can register another person's address with a password they know. For an
  unconfirmed account, "forgot password" and "resend confirmation" send a set-password link (and completing it confirms
  the address), and unconfirmed accounts are deleted after 48 hours.
- `Identity:AllowRegistration=false` turns off public sign-up (invite-only apps); `GET /api/config` tells the web app.
- Same origin for web app and API (Caddy in production, Vite proxy in dev): no CORS.
- **CSRF**: every non-GET `/api` request must send `X-CSRF: 1` (a custom header needs same-origin script).
- Password ≥ 10 chars, lockout 5 attempts / 15 min, confirmed email required to log in.
- Security stamp validated every 5 minutes (`Identity:SecurityStampValidationInterval`): a password change/reset or a
  2FA change invalidates other sessions within that interval. Identity's `/manage/*` endpoints don't refresh the
  caller's own cookie after rotating the stamp, which would sign out the very session that made the change (even
  mid-way through 2FA setup); an endpoint filter re-issues the caller's cookie after a successful change.
- 2FA (TOTP + recovery codes) through `/api/auth/manage/2fa`, with the current password for every change.
- **Data Protection keys in Postgres** (`data_protection_keys`): sessions survive restarts and deploys, and are
  part of database backups.
- Email links are built from `App:PublicUrl` and point at web app pages (`/confirm-email`, `/reset-password`,
  `/invitations/accept`), never at the request host.
- Rate limit policy `auth` on `/api/auth/*` (default 20/min per client IP; real IPs via trusted forwarded headers).

## Consequences
- Bearer tokens from the same endpoints remain possible later for a mobile client (`useCookies=false`).
- Social login, passkeys and SSO are deferred (0008); Identity supports them when needed.
