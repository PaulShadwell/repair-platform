# Production deployment (Docker Compose + Caddy)

Stack: **PostgreSQL 16** · **API** (`Dockerfile.api`) · **Web** (nginx + static build, proxies `/api`) · **Caddy** (HTTPS on 80/443).

## Prerequisites

- Docker Engine + Docker Compose v2
- A server with ports **80** and **443** open (e.g. Exoscale Security Group)
- DNS **A/AAAA** for your hostname pointing at the server **before** first start (for Let’s Encrypt)

## 1. Configure environment

From the `infra/` directory:

```bash
cp .env.production.example .env.production
```

Edit `.env.production`:

| Variable | Purpose |
|----------|---------|
| `SERVER_NAME` | Hostname for Caddy / TLS (e.g. `repairs.example.ch`) |
| `PUBLIC_BASE_URL` | Full site URL, no trailing slash (password reset links) |
| `CORS_ORIGIN` | Same as `PUBLIC_BASE_URL` for a normal single-origin deploy |
| `POSTGRES_PASSWORD` | Strong password |
| `DATABASE_URL` | Must use host `postgres` and match user/db/password above |
| `JWT_SECRET` | Long random string |

Optional: SMTP variables for self-service password reset (see `apps/api/.env.example`).

## 2. Build images

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production build
```

## 3. Start database and run migrations

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d postgres
docker compose -f docker-compose.prod.yml --env-file .env.production --profile migrate run --rm migrate
```

Re-run the `migrate` command after pulling images that include new Prisma migrations.

## 4. Start everything

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

- Site: `https://<SERVER_NAME>/`
- API (via same host): `https://<SERVER_NAME>/api/...`

## 5. First admin user

The production API image does not include `tsx`, so `npm run seed` is not available inside the container by default. Options:

- Run seed **once** from your dev machine with `DATABASE_URL` pointed at production (e.g. SSH tunnel to Postgres), **or**
- Create the first admin with a SQL/script approach you trust.

Change default passwords immediately after first login.

## HTTP-only (no TLS / testing on an IP)

1. Replace the Caddy mount in `docker-compose.prod.yml` temporarily:

   ```yaml
   volumes:
     - ./Caddyfile.http-only:/etc/caddy/Caddyfile:ro
   ```

2. You can remove or relax the `SERVER_NAME` requirement by editing the compose file (remove `environment: SERVER_NAME` from `caddy` if unused), or set `SERVER_NAME` to any placeholder since the http-only file ignores it.

3. Use `PUBLIC_BASE_URL` / `CORS_ORIGIN` as `http://<server-ip>` for that test.

For production, switch back to `Caddyfile` and a real hostname.

## Updates / redeploy

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production build
docker compose -f docker-compose.prod.yml --env-file .env.production --profile migrate run --rm migrate
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

## Data & backups

- **Database**: volume `postgres_data`
- **Uploads** (photos, avatars): volume `api_storage` → `/app/storage` in the API container

Back up regularly:

- Exoscale volume snapshots **and/or**
- `pg_dump` (cron) **and/or**
- Copy `/var/lib/docker/volumes/...` strategy you prefer

## Print agents

POS machines run the print agent against your **public** `https://<SERVER_NAME>/api/...`. Ensure `PUBLIC_BASE_URL` matches what users and agents use.

## Resource hint

For a single repair café, **~2 GB RAM** on the VM (e.g. Exoscale **Small**) is a reasonable starting point for Postgres + API + web + Caddy.
