# Repair Platform Rewrite

Modern rewrite of the legacy RepairKafi PHP/SQLite system with:

- PostgreSQL data store
- Secure per-user login and role-based access
- Repairer-scoped default views with assignment workflows
- Multi-photo attachments using object/file storage
- 80mm thermal label printing with direct ESC/POS payloads and QR deep links

## Stack

- `apps/api`: Express + TypeScript + Prisma + PostgreSQL
- `apps/web`: React + TypeScript + Vite
- `infra`: Docker Compose for PostgreSQL and MinIO

## Quick Start

1. Start infra:

   `docker compose -f infra/docker-compose.yml up -d`

2. Configure API environment:

   - Copy `apps/api/.env.example` to `apps/api/.env`
   - Set `DATABASE_URL`, `JWT_SECRET`, `PUBLIC_BASE_URL`, and printer settings

3. Install and migrate:

   `npm install`

   `npm run prisma:generate -w apps/api`

   `npm run prisma:migrate -w apps/api -- --name init`

   `npm run seed -w apps/api`

4. Start apps:

   - API: `npm run dev -w apps/api`
   - Web: `npm run dev -w apps/web`

## Default Seeded Users

- `admin` / `ChangeMe123!`
- `repairer.demo` / `ChangeMe123!`

Change passwords immediately after first login.

## Data Migration from Legacy SQLite

Run:

`npm run migrate:sqlite -w apps/api -- ../../db/repairkafi.sqlite`

If your shell is at `repair-platform` root, this often needs to be:

`npm run migrate:sqlite -w apps/api -- ../../../db/repairkafi.sqlite`

This imports legacy repairs, maps status values, creates repairer users (from `reparateur`), and generates stable `publicRef` values for QR routing.

## Label Printing (80mm Roll, ESC/POS)

- Endpoint: `POST /api/repairs/:id/print-label`
- Supports:
  - `dryRun: true` to validate payload without sending
  - spool mode (writes `.bin` to `PRINT_SPOOL_DIR`)
  - macOS/Linux system queue mode via `lp` (`DEFAULT_PRINTER_MODE=system`)
  - relay mode (`DEFAULT_PRINTER_MODE=relay`) to forward raw bytes to a host-side print relay
  - direct TCP mode via printer profiles
- pull-agent mode (no tunnel) via paired local print agents

For local system queue printing, set:

- `DEFAULT_PRINTER_MODE=system`
- optionally `SYSTEM_PRINTER_NAME=<your-cups-printer-name>` (if omitted, default CUPS printer is used)

For cluster-to-host printing via relay, set:

- `DEFAULT_PRINTER_MODE=relay`
- `PRINT_RELAY_URL=http://<relay-host>:9321/print`
- `PRINT_RELAY_TOKEN=<shared-secret>`
- optional `PRINT_RELAY_TIMEOUT_MS=10000`

A minimal relay service for macOS is provided at `tools/print-relay/print-relay.mjs`.

For cloud-hosted API + local laptop printers without tunnels, use `tools/print-agent/agent.mjs` (or download the standalone package from GitHub Releases):

1. Admin creates a pairing code with `POST /api/printers/:id/pair-code`
2. Laptop pairs once: `node tools/print-agent/agent.mjs pair --api <url> --code <PAIRCODE> --printer <cups-name>`
3. Laptop runs agent: `node tools/print-agent/agent.mjs run`

To build release-ready standalone folders locally, run:

`npm run build:print-agent-packages`

When an active agent is paired to a selected printer profile, print jobs are queued and delivered to that laptop over outbound polling.

Printed label content pre-fills fields when data exists; missing values remain blank for handwriting.

## Web Label Preview Simulator

- The repair detail page now includes a visual `80mm` label simulator that mirrors the card-like print structure.
- It generates a live QR pointing to `/repairs/{publicRef}` and offers a browser print preview button for quick layout checks.
- This is a visual validation aid; production printing still uses the ESC/POS endpoint.

## Important Notes

- The API currently uses local disk storage as object storage abstraction; MinIO/S3 adapter can be added without schema changes.
- Authorization is server-side for all list, detail, update, assignment, photo, and print actions.
