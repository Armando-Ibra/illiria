# Deploy: one VM with Docker Compose

```
Internet ──443──> web (Caddy: TLS, SPA, /api proxy) ──> api (ASP.NET Core) ──> postgres
                                                   migrate (one-shot, runs before api)
```

Same origin for app and API: the auth cookie stays `SameSite`, and there is no CORS to configure.
`/health/*` is not exposed publicly.

## First deploy

1. A VM with Docker Engine + the compose plugin (2 vCPU / 4 GB is plenty to start), ports 80/443 open,
   and a DNS record for `APP_DOMAIN` pointing at it.
2. Copy the repository (or just `deploy/` if you pull prebuilt images) to e.g. `/opt/illiria`.
3. `cp deploy/.env.example deploy/.env` and fill it in (`openssl rand -base64 32` for the password).
4. `cd deploy && docker compose up -d --build`
   - `migrate` applies the EF Core migrations and exits; `api` starts only if it succeeded.
   - Caddy requests the TLS certificate on first start.
5. Open `https://APP_DOMAIN` and register. In `Single` tenancy mode the first user becomes the
   owner of the default organization.

## Updates

```bash
cd /opt/illiria && git pull          # or set API_IMAGE / WEB_IMAGE to new tags
cd deploy && docker compose up -d --build
```

Migrations run again on every `up` (no-op when there's nothing new). Write migrations so the previous
API version keeps working against the new schema while containers swap (add columns, don't rename in place).

## Backups (do this on day one)

`backup.sh` writes a custom-format `pg_dump` to `deploy/backups/`, keeps 14 days, and copies it
off-site with `rclone` when `RCLONE_REMOTE` is set (e.g. Cloudflare R2 or Backblaze B2).

```cron
15 3 * * * /opt/illiria/deploy/backup.sh >> /var/log/illiria-backup.log 2>&1
```

Restore (test it, a backup you never restored is a hope, not a backup):

```bash
docker compose exec -T postgres pg_restore -U illiria -d illiria --clean --if-exists < backups/<file>.dump
```

Backups are written owner-only (`umask 077`). Set `AGE_RECIPIENT` in `.env` to encrypt them with
[age](https://age-encryption.org) before they leave the server (keep the private key elsewhere); restore with
`age -d -i key.txt <file>.dump.age | docker compose exec -T postgres pg_restore -U illiria -d illiria --clean --if-exists`.

The database also holds the ASP.NET Core Data Protection keys (`data_protection_keys`) and the sessions: restoring it
keeps existing sessions valid. Losing it signs everyone out. Anyone with a plain dump could forge sessions, so either
encrypt backups or protect the key ring with a certificate:

```yaml
# deploy/compose.yml, under x-api: environment + a mounted secret
DataProtection__CertificatePath: /run/secrets/dataprotection.pfx
DataProtection__CertificatePassword: ${DATAPROTECTION_CERT_PASSWORD}
```

Generate it once (`openssl req -x509 -newkey rsa:3072 -nodes -days 3650 -subj /CN=illiria-dataprotection -keyout k.pem -out c.pem && openssl pkcs12 -export -inkey k.pem -in c.pem -out dataprotection.pfx`)
and back it up separately from the database. Turning it on later is fine; existing keys stay readable.

## Access settings

- `TENANCY_MODE=Single` with `TENANCY_OWNER_EMAIL=you@example.com`: that address becomes Owner of the default
  organization when it confirms its email (otherwise the first confirmed user does).
- `ALLOW_REGISTRATION=false`: invite-only; the sign-up page disappears and `/api/auth/register` returns 404.

## Operations notes

- Logs: `docker compose logs -f api`.
- Shell into the database: `docker compose exec postgres psql -U illiria`.
- Rate limiting sees real client IPs because the API trusts `X-Forwarded-For` only from Caddy's
  network (`172.30.0.0/24`, fixed in `compose.yml`). Change both together.
- The web image's CSP is in `Caddyfile`; loosen it there if you add third-party scripts.
