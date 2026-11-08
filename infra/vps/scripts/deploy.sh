#!/usr/bin/env bash
# Deploy (or update) one tenant: pull images, run Prisma migrations, start/refresh containers.
# Usage: scripts/deploy.sh <tenant> [--build]
#   --build   build images locally from this checkout instead of pulling from GHCR
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
NAME="${1:?tenant name}"
MODE="${2:-}"
ENV_FILE="$HERE/tenants/$NAME.env"
[ -f "$ENV_FILE" ] || { echo "missing $ENV_FILE (run new-tenant.sh first)"; exit 1; }

export COMPOSE_PROJECT_NAME="$NAME"
dc() { docker compose -f "$HERE/tenant/docker-compose.yml" --env-file "$ENV_FILE" "$@"; }

if [ "$MODE" = "--build" ]; then
  # Local build: tag as the names the compose file expects.
  set -a; . "$ENV_FILE"; set +a
  TAG="${IMAGE_TAG:-latest}"
  docker build -f "$REPO/Dockerfile.api" -t "${IMAGE_API:-ghcr.io/paulshadwell/repair-platform/api}:$TAG" "$REPO"
  docker build -f "$REPO/Dockerfile.web" --build-arg VITE_API_BASE_URL=/api \
    -t "${IMAGE_WEB:-ghcr.io/paulshadwell/repair-platform/web}:$TAG" "$REPO"
else
  dc pull api web migrate
fi

dc up -d postgres
dc --profile migrate run --rm migrate
dc up -d --remove-orphans
dc ps
echo "Deployed $NAME → https://$(grep '^TENANT_HOST=' "$ENV_FILE" | cut -d= -f2)"
