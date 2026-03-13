## Print Agent (Cloud-safe, no tunnel)

Use this on each POS laptop to print via local driver while API stays in cloud.

### 1) Pair code (admin)

Create a pairing code for a printer profile:

`POST /api/printers/:id/pair-code`

The code is valid for 10 minutes.

### 2) Pair on laptop (one-time)

```bash
cd tools/print-agent
node agent.mjs pair \
  --api "https://repair-platform.techvee.cloud" \
  --code "<PAIRCODE>" \
  --name "Cafe-Laptop-1" \
  --printer "Label_TD80"
```

This stores config at `~/.repair-platform-print-agent.json`.

### 3) Run agent

```bash
cd tools/print-agent
node agent.mjs run
```

Agent polls cloud for jobs and prints locally using `lp -o raw`.

### Optional: auto-start on macOS login (launchd)

After pairing once, install as background service:

```bash
cd tools/print-agent
chmod +x install-launchd.sh uninstall-launchd.sh
./install-launchd.sh
```

Useful commands:

```bash
# check service state
launchctl print gui/$(id -u)/com.repairplatform.print-agent

# tail logs
tail -f ~/Library/Logs/RepairPlatform/print-agent.log
tail -f ~/Library/Logs/RepairPlatform/print-agent-error.log

# remove service
./uninstall-launchd.sh
```

### Notes

- No inbound ports and no tunnel required.
- One agent should be paired to one printer profile.
- In web app, select the matching printer profile in the Printer dropdown.
- On Windows, pass a shared printer name in `--printer` (or `\\host\share`).

## Standalone downloadable packages

Build OS-specific folders for release assets:

```bash
npm run build:print-agent-packages
```

This creates:

- `tools/print-agent/packages/repair-print-agent-macos`
- `tools/print-agent/packages/repair-print-agent-windows`
- `tools/print-agent/packages/repair-print-agent-linux`

Zip each folder and upload it to your GitHub Release so POS users can download just the print agent package.

Build ready-to-upload zip release assets in one command:

```bash
npm run build:print-agent-release
```

This creates:

- `tools/print-agent/release-assets/repair-print-agent-macos.zip`
- `tools/print-agent/release-assets/repair-print-agent-windows.zip`
- `tools/print-agent/release-assets/repair-print-agent-linux.zip`

## Publish release with GitHub CLI (one command)

Requirements:

- GitHub CLI installed: [`gh`](https://cli.github.com/)
- Authenticated once: `gh auth login`

Create or update a release and upload all print-agent zip assets:

```bash
npm run release:print-agent -- --tag v2026.03.11-print-agent
```

Useful options:

```bash
# draft release with custom title
npm run release:print-agent -- --tag v2026.03.11-print-agent --title "Print Agent Packages" --draft

# prerelease with custom notes
npm run release:print-agent -- --tag v2026.03.11-print-agent --prerelease --notes "Beta print-agent packages"
```
