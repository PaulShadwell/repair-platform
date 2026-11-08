# Production on a single VPS (Infomaniak VPS Lite) — multi-tenant

One small Linux VPS hosts several Repair Cafés. Each café ("tenant") is a fully separate
Docker Compose project — its own PostgreSQL, API, web container and photo storage — and a
single shared Caddy terminates TLS and routes by hostname.

```
                 ┌─────────────── edge network ───────────────┐
Internet ─443─▶  │ Caddy ─▶ turbenthal-web ─▶ api ─▶ postgres │  (project: turbenthal)
                 │       ─▶ seuzach-web    ─▶ api ─▶ postgres │  (project: seuzach)
                 └────────────────────────────────────────────┘
```

Tenants today: `turbenthal.rctrepairs.ch`, `seuzach.rctrepairs.ch`. The bare domain redirects to Turbenthal.

Sizing: VPS Lite 2 vCPU / 4 GB is enough for two tenants (each stack idles at ~250 MB).

## Files

| Path | Purpose |
|---|---|
| `caddy/` | Shared reverse proxy (compose + Caddyfile, one block per tenant) |
| `tenant/docker-compose.yml` | Generic per-tenant stack; parametrised by `tenants/<name>.env` |
| `tenants/example.env` | Template. Real `*.env` files hold secrets and are git-ignored |
| `scripts/server-setup.sh` | One-time VPS preparation (Docker, ufw, unattended-upgrades, `edge` network, clone) |
| `scripts/new-tenant.sh` | Generates a tenant env file with random secrets and prints DNS/Caddy steps |
| `scripts/deploy.sh <tenant> [--build]` | Pull (or build) images, run Prisma migrations, start/refresh |
| `scripts/deploy-all.sh` | Same for every tenant |
| `scripts/seed-admin.sh <tenant>` | Creates the first ADMIN user (forced password change) |
| `scripts/backup.sh` / `restore.sh` | Nightly `pg_dump` + storage tar per tenant; optional rclone off-site sync |

## First-time setup

```bash
# on the VPS, as root
curl -fsSL https://raw.githubusercontent.com/PaulShadwell/repair-platform/main/infra/vps/scripts/server-setup.sh | bash
cd /srv/repair-platform/infra/vps

# DNS: A records for turbenthal.rctrepairs.ch and seuzach.rctrepairs.ch → VPS IP (before starting Caddy)
(cd caddy && docker compose up -d)

# if the GHCR packages are private:
docker login ghcr.io -u PaulShadwell      # PAT with read:packages

scripts/new-tenant.sh turbenthal turbenthal.rctrepairs.ch
scripts/deploy.sh turbenthal
scripts/seed-admin.sh turbenthal

scripts/new-tenant.sh seuzach seuzach.rctrepairs.ch
scripts/deploy.sh seuzach
scripts/seed-admin.sh seuzach

# nightly backups
echo '30 3 * * * /srv/repair-platform/infra/vps/scripts/backup.sh >> /var/log/repair-backup.log 2>&1' | crontab -
```

## Migrating the existing Turbenthal data from the k3s cluster

```bash
# on the old side (kubectl context of the home cluster)
kubectl -n repair-platform exec deploy/repair-platform-postgres -- sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' > turbenthal.dump
kubectl -n repair-platform exec deploy/repair-platform-api -- tar -czf - -C /app storage > turbenthal-storage.tgz

# copy both to the VPS, then
scripts/restore.sh turbenthal turbenthal.dump turbenthal-storage.tgz
```

Then re-pair the print agents on the POS laptops against `https://turbenthal.rctrepairs.ch/api`
(pairing codes are stored in the migrated database, so existing pairings survive if the agent URL is updated).

## Updating

`git push` to `main` builds new images via GitHub Actions. On the VPS:

```bash
cd /srv/repair-platform && git pull
infra/vps/scripts/deploy-all.sh          # or deploy.sh <tenant> to roll out one café first
```

Pin `IMAGE_TAG=<short-sha>` in a tenant env file to hold a café on a known version.

## Operations notes

- **Backups**: `/srv/backups`, 14 days retained. Set `RCLONE_REMOTE` (e.g. an Infomaniak Swiss Backup
  or kDrive remote) in the cron environment for off-site copies — VPS Lite has no included backups.
- **OS patches**: unattended-upgrades is enabled; reboot monthly. Containers restart automatically.
- **Image updates**: `deploy-all.sh` is the only way images change; nothing auto-pulls.
- **Logs**: `COMPOSE_PROJECT_NAME=turbenthal docker compose -f tenant/docker-compose.yml --env-file tenants/turbenthal.env logs -f api`
- **Adding a café**: `new-tenant.sh`, DNS, Caddyfile block, `deploy.sh`, `seed-admin.sh` — about ten minutes.
- **Branding per café**: logo and app name are stored in each tenant's database (`SiteSetting`), set via the Settings tab.
