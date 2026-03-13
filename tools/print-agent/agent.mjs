import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const CONFIG_PATH = path.join(os.homedir(), ".repair-platform-print-agent.json");

function parseArgs(argv) {
  const [command, ...rest] = argv.slice(2);
  const args = {};
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = rest[i + 1] && !rest[i + 1].startsWith("--") ? rest[i + 1] : "true";
    args[key] = value;
    if (value !== "true") i += 1;
  }
  return { command, args };
}

async function saveConfig(config) {
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
}

async function loadConfig() {
  const content = await fs.readFile(CONFIG_PATH, "utf8");
  return JSON.parse(content);
}

async function pairAgent(args) {
  const apiBaseUrl = (args.api ?? process.env.PRINT_AGENT_API_URL ?? "").replace(/\/+$/, "");
  const code = args.code ?? process.env.PRINT_AGENT_PAIR_CODE ?? "";
  const agentName = args.name ?? os.hostname();
  const printerName = args.printer ?? process.env.SYSTEM_PRINTER_NAME ?? "Label_TD80";
  if (!apiBaseUrl || !code) {
    throw new Error("Usage: node agent.mjs pair --api <url> --code <PAIRCODE> [--name <agent-name>] [--printer <cups-printer>]");
  }

  const response = await fetch(`${apiBaseUrl}/api/print-agent/pair`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, agentName }),
  });
  if (!response.ok) {
    throw new Error(`Pair failed: ${response.status} ${await response.text()}`);
  }
  const data = await response.json();
  const config = {
    apiBaseUrl,
    token: data.agent.token,
    agentId: data.agent.id,
    printerProfileId: data.agent.printerProfileId,
    agentName,
    printerName,
  };
  await saveConfig(config);
  // eslint-disable-next-line no-console
  console.log(`Paired. Config saved to ${CONFIG_PATH}`);
}

async function printRaw(printerName, payloadBuffer) {
  const spoolDir = path.join(os.tmpdir(), "repair-platform-print-agent");
  await fs.mkdir(spoolDir, { recursive: true });
  const spoolPath = path.join(spoolDir, `${Date.now()}-${Math.random().toString(16).slice(2)}.bin`);
  await fs.writeFile(spoolPath, payloadBuffer);

  if (process.platform === "win32") {
    if (!printerName) {
      throw new Error("Windows printing requires --printer (shared printer name).");
    }
    const target = printerName.includes("\\")
      ? printerName
      : `\\\\localhost\\${printerName}`;
    await execFileAsync("cmd", ["/c", "copy", "/b", spoolPath, target]);
    return;
  }

  const args = ["-o", "raw"];
  if (printerName) args.push("-d", printerName);
  args.push(spoolPath);
  await execFileAsync("lp", args);
}

async function completeJob(config, jobId, success, errorMessage) {
  await fetch(`${config.apiBaseUrl}/api/print-agent/jobs/${jobId}/complete`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-agent-token": config.token,
    },
    body: JSON.stringify({ success, errorMessage }),
  });
}

async function pollLoop(args) {
  const intervalMs = Number(args.interval ?? 2000);
  const config = await loadConfig();
  // eslint-disable-next-line no-console
  console.log(`Agent running for profile ${config.printerProfileId} using printer "${config.printerName}"`);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/print-agent/jobs/next`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-agent-token": config.token,
        },
        body: "{}",
      });
      if (response.ok) {
        const data = await response.json();
        if (data.job) {
          const payload = Buffer.from(data.job.payloadBase64, "base64");
          try {
            await printRaw(config.printerName, payload);
            await completeJob(config, data.job.id, true);
            // eslint-disable-next-line no-console
            console.log(`Printed job ${data.job.id}`);
          } catch (error) {
            const message = error instanceof Error ? error.message : "Print failed";
            await completeJob(config, data.job.id, false, message);
            // eslint-disable-next-line no-console
            console.error(`Failed job ${data.job.id}: ${message}`);
          }
        }
      } else {
        // eslint-disable-next-line no-console
        console.error(`Poll failed: ${response.status}`);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Poll error", error);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

async function main() {
  const { command, args } = parseArgs(process.argv);
  if (command === "pair") {
    await pairAgent(args);
    return;
  }
  if (command === "run") {
    await pollLoop(args);
    return;
  }
  // eslint-disable-next-line no-console
  console.log("Usage:\n  node agent.mjs pair --api <url> --code <PAIRCODE> [--name <agent-name>] [--printer <cups-printer>]\n  node agent.mjs run [--interval 2000]");
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
