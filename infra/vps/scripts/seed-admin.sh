#!/usr/bin/env bash
# Create (or reset) the initial admin user for a tenant without needing tsx in the image.
# Usage: scripts/seed-admin.sh <tenant> [username] [password]
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
NAME="${1:?tenant name}"
USERNAME="${2:-admin}"
PASSWORD="${3:-$(openssl rand -base64 12)}"
ENV_FILE="$HERE/tenants/$NAME.env"
export COMPOSE_PROJECT_NAME="$NAME"

docker compose -f "$HERE/tenant/docker-compose.yml" --env-file "$ENV_FILE" run --rm \
  -e SEED_USERNAME="$USERNAME" -e SEED_PASSWORD="$PASSWORD" --workdir /app/apps/api --entrypoint node api -e '
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
(async () => {
  const prisma = new PrismaClient();
  const role = await prisma.role.upsert({ where: { key: "ADMIN" }, update: {}, create: { key: "ADMIN" } });
  const hash = await bcrypt.hash(process.env.SEED_PASSWORD, 12);
  const user = await prisma.user.upsert({
    where: { username: process.env.SEED_USERNAME },
    update: { passwordHash: hash, forcePasswordChange: true, isActive: true },
    create: { username: process.env.SEED_USERNAME, fullName: "Administrator", passwordHash: hash, forcePasswordChange: true },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {}, create: { userId: user.id, roleId: role.id },
  });
  console.log("admin user ready:", user.username);
  await prisma.$disconnect();
})();'
echo "Username: $USERNAME"
echo "Password: $PASSWORD   (must be changed at first login)"
