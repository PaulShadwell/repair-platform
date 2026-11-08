#!/usr/bin/env bash
# One-time preparation of a fresh Debian 13 (trixie) / Debian 12 / Ubuntu 24.04 VPS (Infomaniak VPS Lite).
# Run as root:  bash server-setup.sh
set -euo pipefail

apt-get update
apt-get install -y ca-certificates curl git ufw unattended-upgrades fail2ban

# Docker Engine + Compose v2 (official repo)
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker

# Unattended security updates
dpkg-reconfigure -f noninteractive unattended-upgrades

# Firewall: SSH + HTTP/HTTPS only
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

# Shared network for Caddy <-> tenant web containers
docker network inspect edge >/dev/null 2>&1 || docker network create edge

# Code checkout used by deploy.sh
mkdir -p /srv
if [ ! -d /srv/repair-platform ]; then
  git clone https://github.com/PaulShadwell/repair-platform.git /srv/repair-platform
fi
mkdir -p /srv/backups

cat <<'MSG'

Server ready. Next (DNS A records must already point at this server):
  1. (cd /srv/repair-platform/infra/vps/caddy && docker compose up -d)
  2. (optional) docker login ghcr.io   if the GHCR packages are private
  3. cd /srv/repair-platform/infra/vps
  4. scripts/new-tenant.sh turbenthal turbenthal.rctrepairs.ch
  5. scripts/deploy.sh turbenthal
  6. scripts/seed-admin.sh turbenthal
  7. crontab: 30 3 * * * /srv/repair-platform/infra/vps/scripts/backup.sh >> /var/log/repair-backup.log 2>&1
MSG
