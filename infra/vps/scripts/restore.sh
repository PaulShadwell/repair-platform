#!/usr/bin/env bash
# Restore one tenant from a backup pair produced by backup.sh (or a pg_dump -Fc from another system).
# Usage: scripts/restore.sh <tenant> <db.dump> [storage.tgz]
#   storage.tgz must contain a top-level "storage/" directory (storage/photos, storage/print-spool).
# The database schema is dropped and recreated, so ownership differences between source and target
# (e.g. old user repair_platform vs new user postgres) do not matter.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
NAME="${1:?tenant}"; DUMP="${2:?db dump}"; STORE="${3:-}"
ENV_FILE="$HERE/tenants/$NAME.env"
export COMPOSE_PROJECT_NAME="$NAME"
dc() { docker compose -f "$HERE/tenant/docker-compose.yml" --env-file "$ENV_FILE" "$@"; }
set -a; . "$ENV_FILE"; set +a
PGU="${POSTGRES_USER:-postgres}"; PGDB="${POSTGRES_DB:-repair_platform}"

echo "Stopping api/web for $NAME ..."
dc stop api web
dc up -d postgres
echo "Recreating schema and restoring database ..."
dc exec -T postgres psql -U "$PGU" -d "$PGDB" -v ON_ERROR_STOP=1 \
  -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
dc exec -T postgres pg_restore -U "$PGU" -d "$PGDB" --no-owner --no-privileges --exit-on-error < "$DUMP"
if [ -n "$STORE" ]; then
  echo "Restoring storage ..."
  dc run --rm --no-deps --entrypoint sh api -c 'rm -rf /app/storage/* && tar -xzf - -C /app && ls /app/storage' < "$STORE"
fi
echo "Applying any pending migrations and starting ..."
dc --profile migrate run --rm migrate
dc up -d
dc ps
echo "Restored $NAME"
