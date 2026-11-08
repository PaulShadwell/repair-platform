#!/usr/bin/env bash
# Restore one tenant from a backup pair produced by backup.sh.
# Usage: scripts/restore.sh <tenant> <db.dump> [storage.tgz]
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
NAME="${1:?tenant}"; DUMP="${2:?db dump}"; STORE="${3:-}"
ENV_FILE="$HERE/tenants/$NAME.env"
export COMPOSE_PROJECT_NAME="$NAME"
dc() { docker compose -f "$HERE/tenant/docker-compose.yml" --env-file "$ENV_FILE" "$@"; }
set -a; . "$ENV_FILE"; set +a

dc stop api web
dc up -d postgres
dc exec -T postgres pg_restore -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-repair_platform}" --clean --if-exists < "$DUMP"
if [ -n "$STORE" ]; then
  dc run --rm --no-deps --entrypoint sh api -c 'rm -rf /app/storage/* && tar -xzf - -C /app' < "$STORE"
fi
dc up -d
echo "Restored $NAME"
