# Security model

What the starter defends against, how, and what is accepted on purpose. Decisions: ADR 0003 (tenancy) and
ADR 0004 (authentication). Every control below has an integration or architecture test.

## Controls

| Threat | Control |
|---|---|
| Reading or changing another organization's data | Organization only from the route + membership checked on every request (404 for non-members); fail-closed EF filter; writes to foreign rows throw; no bare `IgnoreQueryFilters()`, no raw SQL in features |
| Role escalation | Nobody grants above their own role; only Owners touch Owners; last Owner protected (with a lock) |
| Stolen session cookie | HttpOnly + Secure + SameSite=Lax; server-side sessions revoked on logout; password/2FA/email changes need the current password; password change/reset signs out other sessions; 2FA "remember this browser" only on request |
| CSRF | `X-CSRF` header required on every state-changing `/api` request; no CORS |
| Credential stuffing / brute force | Lockout after 5 failures (15 min); per-IP rate limit on `/api/auth`; 2FA (TOTP) |
| Account pre-registration | Unconfirmed accounts can't sign in; set-password link for unconfirmed accounts; purge after 48 h |
| Invitation abuse | 256-bit single-use tokens stored hashed, 7 days, bound to the confirmed email and to the inviter's current rights; plain addresses only; per-user rate limit; one pending invite per address |
| Link/host spoofing in emails | Links built from `App:PublicUrl` only; user input HTML-encoded |
| Clickjacking / XSS hardening | CSP and frame denial (API and Caddy); no HTML injection APIs in the web app |
| Leaked database or backup | Optional certificate-protected key ring; owner-only, optionally `age`-encrypted backups |
| Misconfigured production | `ProductionGuard` refuses to start without required, safe settings |

## Accepted risks

- **Account enumeration** through registration ("already taken") and lockout responses: inherent to Identity's
  endpoints; rate limiting slows harvesting. Revisit with a custom registration flow if a product needs it.
- **Lockout as denial of service**: anyone can lock an account for 15 minutes by guessing wrong 5 times. Accepted
  in exchange for brute-force protection.
- **A pre-registered account confirmed by an unsolicited click**: if the real owner clicks the confirmation link in an
  email they didn't request, the squatter can sign in until the owner resets the password. The email says to ignore it.
- **Disabling 2FA with the password alone** (no TOTP code): someone with both the session and the password already
  controls the account.
- **TOTP codes can be reused within their 30-second window** (Identity keeps no record of used codes).
- **Confirming an email change signs out the other sessions within 5 minutes**, the one that asked included:
  the address is part of the identity, so a fresh sign-in is acceptable.
