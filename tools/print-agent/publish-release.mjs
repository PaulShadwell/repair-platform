import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..", "..");
const RELEASE_ASSETS_DIR = path.join(SCRIPT_DIR, "release-assets");
const REQUIRED_ASSETS = [
  "repair-print-agent-macos.zip",
  "repair-print-agent-windows.zip",
  "repair-print-agent-linux.zip",
];

function usage() {
  // eslint-disable-next-line no-console
  console.log(`Usage:
  node tools/print-agent/publish-release.mjs --tag <tag> [options]

Options:
  --tag <tag>         Required release tag (example: v2026.03.11-print-agent)
  --title <title>     Optional release title (default: same as tag)
  --notes <text>      Optional release notes text
  --draft             Create as draft release
  --prerelease        Mark release as prerelease
  --help              Show this help

Examples:
  npm run release:print-agent -- --tag v2026.03.11-print-agent
  npm run release:print-agent -- --tag v2026.03.11-print-agent --title "Print Agent Packages" --draft
`);
}

function parseArgs(argv) {
  const options = {
    tag: "",
    title: "",
    notes: "",
    draft: false,
    prerelease: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help") {
      options.help = true;
    } else if (arg === "--draft") {
      options.draft = true;
    } else if (arg === "--prerelease") {
      options.prerelease = true;
    } else if (arg === "--tag" || arg === "--title" || arg === "--notes") {
      const next = argv[index + 1];
      if (!next || next.startsWith("--")) {
        throw new Error(`Missing value for ${arg}`);
      }
      const key = arg.slice(2);
      options[key] = next;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

async function run(command, args, cwd = REPO_ROOT) {
  const { stdout, stderr } = await execFileAsync(command, args, { cwd });
  if (stdout) {
    // eslint-disable-next-line no-console
    console.log(stdout.trim());
  }
  if (stderr) {
    // eslint-disable-next-line no-console
    console.error(stderr.trim());
  }
}

async function ghReleaseExists(tag) {
  try {
    await execFileAsync("gh", ["release", "view", tag], { cwd: REPO_ROOT });
    return true;
  } catch {
    return false;
  }
}

async function ensureAssets() {
  await run("npm", ["run", "build:print-agent-release"], REPO_ROOT);
  for (const file of REQUIRED_ASSETS) {
    const fullPath = path.join(RELEASE_ASSETS_DIR, file);
    await fs.access(fullPath);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    usage();
    return;
  }
  if (!options.tag) {
    usage();
    throw new Error("Missing required --tag");
  }

  await run("gh", ["--version"], REPO_ROOT);
  await ensureAssets();

  const assetPaths = REQUIRED_ASSETS.map((name) => path.join(RELEASE_ASSETS_DIR, name));
  const exists = await ghReleaseExists(options.tag);

  if (exists) {
    // eslint-disable-next-line no-console
    console.log(`Release ${options.tag} exists, uploading assets with overwrite.`);
    await run("gh", ["release", "upload", options.tag, ...assetPaths, "--clobber"], REPO_ROOT);
    return;
  }

  const createArgs = ["release", "create", options.tag, ...assetPaths, "--title", options.title || options.tag];
  if (options.notes) {
    createArgs.push("--notes", options.notes);
  } else {
    createArgs.push("--notes", "Standalone print-agent packages for macOS, Windows, and Linux.");
  }
  if (options.draft) {
    createArgs.push("--draft");
  }
  if (options.prerelease) {
    createArgs.push("--prerelease");
  }

  await run("gh", createArgs, REPO_ROOT);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
