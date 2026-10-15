#!/usr/bin/env bash
# Daily database backup: custom-format pg_dump, local retention, optional off-site copy with rclone.
# Cron (as the deploy user):  15 3 * * * /opt/illiria/deploy/backup.sh >> /var/log/illiria-backup.log 2>&1
# Restore:  docker compose exec -T postgres pg_restore -U illiria -d illiria --clean --if-exists < <file>.dump
set -euo pipefail
cd "$(dirname "$0")"

# Compose reads .env itself; only RCLONE_REMOTE is needed here (values like SMTP_FROM aren't shell-safe to source).
if [ -z "${RCLONE_REMOTE:-}" ] && [ -f .env ]; then
  RCLONE_REMOTE="$(sed -n 's/^RCLONE_REMOTE=//p' .env | tail -n 1)"
fi
backup_dir="${BACKUP_DIR:-./backups}"
keep_days="${KEEP_DAYS:-14}"
mkdir -p "$backup_dir"

file="$backup_dir/illiria-$(date -u +%Y%m%dT%H%M%SZ).dump"
docker compose exec -T postgres pg_dump -U illiria -d illiria --format=custom > "$file.partial"
mv "$file.partial" "$file"
find "$backup_dir" -name 'illiria-*.dump' -mtime +"$keep_days" -delete

if [ -n "${RCLONE_REMOTE:-}" ]; then
  rclone copy "$file" "$RCLONE_REMOTE"
fi

echo "$(date -u +%FT%TZ) backup written: $file"
