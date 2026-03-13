#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_BIN="$(command -v node)"
mkdir -p "$HOME/.config/systemd/user"
cat > "$HOME/.config/systemd/user/repair-platform-print-agent.service" <<EOF
[Unit]
Description=Repair Platform Print Agent
After=network.target

[Service]
Type=simple
WorkingDirectory=${SCRIPT_DIR}
ExecStart=${NODE_BIN} ${SCRIPT_DIR}/agent.mjs run
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
EOF
systemctl --user daemon-reload
systemctl --user enable --now repair-platform-print-agent.service
echo "Installed systemd user service: repair-platform-print-agent.service"
