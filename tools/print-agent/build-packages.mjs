import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(ROOT, "packages");
const RELEASE_DIR = path.join(ROOT, "release-assets");
const RELEASE_HINT = "https://github.com/paulshadwell/repair-platform/releases/latest";
const PACKAGE_NAMES = ["repair-print-agent-macos", "repair-print-agent-windows", "repair-print-agent-linux"];

async function copy(src, dest) {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
}

async function write(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

async function createReleaseZips() {
  await fs.rm(RELEASE_DIR, { recursive: true, force: true });
  await fs.mkdir(RELEASE_DIR, { recursive: true });

  for (const packageName of PACKAGE_NAMES) {
    const packagePath = path.join(OUT_DIR, packageName);
    const zipPath = path.join(RELEASE_DIR, `${packageName}.zip`);
    const zip = new AdmZip();
    zip.addLocalFolder(packagePath, packageName);
    zip.writeZip(zipPath);
  }
}

async function buildMacPackage() {
  const dir = path.join(OUT_DIR, "repair-print-agent-macos");
  await fs.mkdir(dir, { recursive: true });
  await copy(path.join(ROOT, "agent.mjs"), path.join(dir, "agent.mjs"));
  await copy(path.join(ROOT, "install-launchd.sh"), path.join(dir, "install-launchd.sh"));
  await copy(path.join(ROOT, "uninstall-launchd.sh"), path.join(dir, "uninstall-launchd.sh"));
  await write(
    path.join(dir, "README.md"),
    `# Repair Platform Print Agent (macOS)

1. Install Node.js LTS (20+).
2. Pair once:
   \`\`\`bash
   node agent.mjs pair --api "https://repair-platform.techvee.cloud" --code "<PAIRCODE>" --name "POS-Mac-1" --printer "Label_TD80"
   \`\`\`
3. Run agent:
   \`\`\`bash
   node agent.mjs run
   \`\`\`
4. Optional auto-start:
   \`\`\`bash
   chmod +x install-launchd.sh uninstall-launchd.sh
   ./install-launchd.sh
   \`\`\`
`,
  );
}

async function buildWindowsPackage() {
  const dir = path.join(OUT_DIR, "repair-print-agent-windows");
  await fs.mkdir(dir, { recursive: true });
  await copy(path.join(ROOT, "agent.mjs"), path.join(dir, "agent.mjs"));
  await write(
    path.join(dir, "run-agent.ps1"),
    `$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
node .\\agent.mjs run
`,
  );
  await write(
    path.join(dir, "install-startup-task.ps1"),
    `$ErrorActionPreference = "Stop"
$taskName = "RepairPlatformPrintAgent"
$scriptPath = Join-Path $PSScriptRoot "run-agent.ps1"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File \\"$scriptPath\\""
$trigger = New-ScheduledTaskTrigger -AtLogOn
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Description "Repair Platform print agent" -Force | Out-Null
Write-Host "Installed startup task: $taskName"
`,
  );
  await write(
    path.join(dir, "uninstall-startup-task.ps1"),
    `$ErrorActionPreference = "Stop"
$taskName = "RepairPlatformPrintAgent"
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
Write-Host "Removed startup task: $taskName"
`,
  );
  await write(
    path.join(dir, "README.md"),
    `# Repair Platform Print Agent (Windows)

1. Install Node.js LTS (20+).
2. Share your printer in Windows and note the share name.
3. Pair once (PowerShell):
   \`\`\`powershell
   node .\\agent.mjs pair --api "https://repair-platform.techvee.cloud" --code "<PAIRCODE>" --name "POS-Win-1" --printer "Label_TD80"
   \`\`\`
4. Run agent:
   \`\`\`powershell
   .\\run-agent.ps1
   \`\`\`
5. Optional auto-start:
   \`\`\`powershell
   .\\install-startup-task.ps1
   \`\`\`

Note: On Windows, \`--printer\` is treated as a shared printer name (or full \\\\host\\share path).
`,
  );
}

async function buildLinuxPackage() {
  const dir = path.join(OUT_DIR, "repair-print-agent-linux");
  await fs.mkdir(dir, { recursive: true });
  await copy(path.join(ROOT, "agent.mjs"), path.join(dir, "agent.mjs"));
  await write(
    path.join(dir, "run-agent.sh"),
    `#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
node ./agent.mjs run
`,
  );
  await write(
    path.join(dir, "install-systemd-user.sh"),
    `#!/usr/bin/env bash
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
WorkingDirectory=\${SCRIPT_DIR}
ExecStart=\${NODE_BIN} \${SCRIPT_DIR}/agent.mjs run
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
EOF
systemctl --user daemon-reload
systemctl --user enable --now repair-platform-print-agent.service
echo "Installed systemd user service: repair-platform-print-agent.service"
`,
  );
  await write(
    path.join(dir, "uninstall-systemd-user.sh"),
    `#!/usr/bin/env bash
set -euo pipefail
systemctl --user disable --now repair-platform-print-agent.service || true
rm -f "$HOME/.config/systemd/user/repair-platform-print-agent.service"
systemctl --user daemon-reload
echo "Removed systemd user service."
`,
  );
  await write(
    path.join(dir, "README.md"),
    `# Repair Platform Print Agent (Linux)

1. Install Node.js LTS (20+).
2. Pair once:
   \`\`\`bash
   node ./agent.mjs pair --api "https://repair-platform.techvee.cloud" --code "<PAIRCODE>" --name "POS-Linux-1" --printer "Label_TD80"
   \`\`\`
3. Run agent:
   \`\`\`bash
   chmod +x run-agent.sh
   ./run-agent.sh
   \`\`\`
4. Optional auto-start:
   \`\`\`bash
   chmod +x install-systemd-user.sh uninstall-systemd-user.sh
   ./install-systemd-user.sh
   \`\`\`
`,
  );
}

async function main() {
  const createZipAssets = process.argv.includes("--zip");
  await fs.rm(OUT_DIR, { recursive: true, force: true });
  await fs.mkdir(OUT_DIR, { recursive: true });
  await buildMacPackage();
  await buildWindowsPackage();
  await buildLinuxPackage();
  if (createZipAssets) {
    await createReleaseZips();
  }
  await write(
    path.join(OUT_DIR, "README.md"),
    `Print agent package folders created:

- repair-print-agent-macos
- repair-print-agent-windows
- repair-print-agent-linux

Zip each folder and upload as GitHub Release assets.
Release page: ${RELEASE_HINT}
`,
  );
  if (createZipAssets) {
    await write(
      path.join(RELEASE_DIR, "README.md"),
      `Release assets created:

- repair-print-agent-macos.zip
- repair-print-agent-windows.zip
- repair-print-agent-linux.zip

Upload these files to GitHub Releases:
${RELEASE_HINT}
`,
    );
  }
  // eslint-disable-next-line no-console
  console.log(`Created packages in: ${OUT_DIR}`);
  if (createZipAssets) {
    // eslint-disable-next-line no-console
    console.log(`Created release assets in: ${RELEASE_DIR}`);
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
