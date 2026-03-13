# Pilot and Cutover Runbook

## 1) Pilot Preparation

- Confirm PostgreSQL backups enabled.
- Configure one printer profile for the target 80mm thermal printer.
- Seed pilot users and assign initial roles.
- Import a subset of legacy repairs (or full import in staging).

## 2) Pilot Test Checklist

- Login works for repairer and supervisor/admin.
- Repairer sees only own repairs by default.
- Supervisor can switch to full list and assign repairs.
- Photos upload and open correctly from detail view.
- Label print succeeds (dry run and real print).
- QR scan opens the exact repair record by `publicRef`.
- Status/assignment/print actions are visible in history or logs.

## 3) Printer Tuning

- Validate:
  - line width/chars-per-line,
  - QR size and readability,
  - codepage for umlauts/special characters,
  - cutter/feeding behavior.
- Save tuned values in `printer_profiles`.

## 4) Cutover Plan

1. Freeze legacy writes (read-only window).
2. Execute final SQLite import.
3. Run validation checks:
   - row counts by table,
   - spot-check sample repairs,
   - assignment consistency.
4. Switch users to new web app URL.
5. Monitor logs and print success metrics closely.

## 5) Rollback Plan

- Keep legacy system available in read-only mode for reference.
- If severe defect occurs:
  - stop new writes to rewritten platform,
  - revert users to legacy UI,
  - document delta period for replay/import.

## 6) Post-Go-Live Hardening

- Enforce password reset for seeded users.
- Enable TLS and secure cookie/token policy at ingress.
- Add scheduled integrity checks on photo storage keys.
- Review audit logs weekly during stabilization period.
