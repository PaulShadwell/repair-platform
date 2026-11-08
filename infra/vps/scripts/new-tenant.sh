#!/usr/bin/env bash
# Create the env file for a new Repair Cafe tenant and print the remaining manual steps.
# Usage: scripts/new-tenant.sh <name> <hostname>
#   e.g. scripts/new-tenant.sh seuzach seuzach.rctrepairs.ch
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
NAME="${1:?tenant name (lowercase, a-z0-9-)}"
HOST="${2:?public hostname}"
ENV_FILE="$HERE/tenants/$NAME.env"

[[ "$NAME" =~ ^[a-z0-9-]+$ ]] || { echo "name must be lowercase a-z0-9-"; exit 1; }
[ -e "$ENV_FILE" ] && { echo "$ENV_FILE already exists"; exit 1; }

cat > "$ENV_FILE" <<ENV
TENANT_NAME=$NAME
TENANT_HOST=$HOST
POSTGRES_USER=postgres
POSTGRES_PASSWORD=$(openssl rand -hex 24)
POSTGRES_DB=repair_platform
JWT_SECRET=$(openssl rand -hex 48)
# IMAGE_TAG=latest
# SMTP_HOST=
# SMTP_PORT=587
# SMTP_SECURE=false
# SMTP_USER=
# SMTP_PASS=
# SMTP_FROM=noreply@rctrepairs.ch
ENV
chmod 600 "$ENV_FILE"

cat <<MSG
Created $ENV_FILE

Now:
  1. DNS: A/AAAA record  $HOST  -> this server's IP
  2. Add to caddy/Caddyfile:

$HOST {
	import tenant $NAME-web
}

     then: (cd $HERE/caddy && docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile)
  3. $HERE/scripts/deploy.sh $NAME
  4. Create the first admin user:  $HERE/scripts/seed-admin.sh $NAME
MSG
