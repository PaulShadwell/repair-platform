# Repair Platform Print Agent (Linux)

1. Install Node.js LTS (20+).
2. Pair once:
   ```bash
   node ./agent.mjs pair --api "https://repair-platform.techvee.cloud" --code "<PAIRCODE>" --name "POS-Linux-1" --printer "Label_TD80"
   ```
3. Run agent:
   ```bash
   chmod +x run-agent.sh
   ./run-agent.sh
   ```
4. Optional auto-start:
   ```bash
   chmod +x install-systemd-user.sh uninstall-systemd-user.sh
   ./install-systemd-user.sh
   ```
