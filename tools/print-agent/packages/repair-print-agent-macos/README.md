# Repair Platform Print Agent (macOS)

1. Install Node.js LTS (20+).
2. Pair once:
   ```bash
   node agent.mjs pair --api "https://repair-platform.techvee.cloud" --code "<PAIRCODE>" --name "POS-Mac-1" --printer "Label_TD80"
   ```
3. Run agent:
   ```bash
   node agent.mjs run
   ```
4. Optional auto-start:
   ```bash
   chmod +x install-launchd.sh uninstall-launchd.sh
   ./install-launchd.sh
   ```
