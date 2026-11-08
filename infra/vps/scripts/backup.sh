#!/usr/bin/env bash
# Nightly backup of every tenant: pg_dump (custom format) + tar of photos/print spool.
# Keeps 14 days locally in /srv/backups; optionally syncs to remote storage with rclone
# (e.g. Infomaniak Swiss Backup / kDrive / S3) when RCLONE_REMOTE is set.
# Cron: 30 3 * * * /srv/repair-platform/infra/vps/scripts/backup.sh >> /var/log/repair-backup.log 2>&1
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${BACKUP_DIR:-/srv/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M)"
mkdir -p "$DEST"

for f in "$HERE"/tenants/*.env; do
  n="$(basename "$f" .env)"
  [ "$n" = "example" ] && continue
  export COMPOSE_PROJECT_NAME="$n"
  dc() { docker compose -f "$HERE/tenant/docker-compose.yml" --env-file "$f" "$@"; }
  set -a; . "$f"; set +a
  echo "[$STAMP] $n: database"
  dc exec -T postgres pg_dump -U "${POSTGRES_USER:-postgres}" -Fc "${POSTGRES_DB:-repair_platform}" \
    > "$DEST/$n-db-$STAMP.dump"
  echo "[$STAMP] $n: storage"
  dc run --rm --no-deps --entrypoint tar api -czf - -C /app storage > "$DEST/$n-storage-$STAMP.tgz"
done

find "$DEST" -type f -mtime +"$KEEP_DAYS" -delete

if [ -n "${RCLONE_REMOTE:-}" ] && command -v rclone >/dev/null 2>&1; then
  rclone sync "$DEST" "$RCLONE_REMOTE" --fast-list
fi
echo "[$STAMP] done"
