#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_BIN="${NODE_BIN:-$(command -v node || true)}"
PLIST_PATH="${HOME}/Library/LaunchAgents/com.repairplatform.print-agent.plist"
LOG_DIR="${HOME}/Library/Logs/RepairPlatform"
LABEL="com.repairplatform.print-agent"

if [[ -z "${NODE_BIN}" ]]; then
  echo "node was not found in PATH. Install Node.js first."
  exit 1
fi

mkdir -p "$(dirname "${PLIST_PATH}")" "${LOG_DIR}"

cat > "${PLIST_PATH}" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${NODE_BIN}</string>
    <string>${SCRIPT_DIR}/agent.mjs</string>
    <string>run</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${SCRIPT_DIR}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/print-agent.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/print-agent-error.log</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)" "${PLIST_PATH}" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "${PLIST_PATH}"
launchctl enable "gui/$(id -u)/${LABEL}"
launchctl kickstart -k "gui/$(id -u)/${LABEL}"

echo "Installed and started ${LABEL}"
echo "plist: ${PLIST_PATH}"
echo "logs: ${LOG_DIR}/print-agent.log"
