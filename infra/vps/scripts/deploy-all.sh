#!/usr/bin/env bash
# Update every tenant that has an env file (except example.env).
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
for f in "$HERE"/tenants/*.env; do
  n="$(basename "$f" .env)"
  [ "$n" = "example" ] && continue
  echo "=== $n ==="
  "$HERE/scripts/deploy.sh" "$n" "$@"
done
