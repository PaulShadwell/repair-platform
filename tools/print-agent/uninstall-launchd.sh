#!/usr/bin/env bash
set -euo pipefail

PLIST_PATH="${HOME}/Library/LaunchAgents/com.repairplatform.print-agent.plist"
LABEL="com.repairplatform.print-agent"

launchctl bootout "gui/$(id -u)" "${PLIST_PATH}" >/dev/null 2>&1 || true
launchctl disable "gui/$(id -u)/${LABEL}" >/dev/null 2>&1 || true
rm -f "${PLIST_PATH}"

echo "Uninstalled ${LABEL}"
