# Repair Platform Print Agent (Windows)

1. Install Node.js LTS (20+).
2. Share your printer in Windows and note the share name.
3. Pair once (PowerShell):
   ```powershell
   node .\agent.mjs pair --api "https://repair-platform.techvee.cloud" --code "<PAIRCODE>" --name "POS-Win-1" --printer "Label_TD80"
   ```
4. Run agent:
   ```powershell
   .\run-agent.ps1
   ```
5. Optional auto-start:
   ```powershell
   .\install-startup-task.ps1
   ```

Note: On Windows, `--printer` is treated as a shared printer name (or full \\host\share path).
