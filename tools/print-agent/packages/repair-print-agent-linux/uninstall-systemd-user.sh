#!/usr/bin/env bash
set -euo pipefail
systemctl --user disable --now repair-platform-print-agent.service || true
rm -f "$HOME/.config/systemd/user/repair-platform-print-agent.service"
systemctl --user daemon-reload
echo "Removed systemd user service."
