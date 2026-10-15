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

The database also holds the ASP.NET Core Data Protection keys (`data_protection_keys`): restoring it keeps
existing sessions valid. Losing it signs everyone out.

## Operations notes

- Logs: `docker compose logs -f api`.
- Shell into the database: `docker compose exec postgres psql -U illiria`.
- Rate limiting sees real client IPs because the API trusts `X-Forwarded-For` only from Caddy's
  network (`172.30.0.0/24`, fixed in `compose.yml`). Change both together.
- The web image's CSP is in `Caddyfile`; loosen it there if you add third-party scripts.
