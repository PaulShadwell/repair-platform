import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const port = Number(process.env.PRINT_RELAY_PORT ?? 9321);
const tcpPort = Number(process.env.PRINT_RELAY_TCP_PORT ?? 9100);
const token = process.env.PRINT_RELAY_TOKEN ?? "";
const printerName = process.env.SYSTEM_PRINTER_NAME ?? "Label_TD80";
const spoolDir = path.resolve(process.env.PRINT_RELAY_SPOOL_DIR ?? "./spool");
const maxBodyBytes = Number(process.env.PRINT_RELAY_MAX_BYTES ?? 512000);

async function queuePrint(payloadBuffer) {
  const fileName = `${Date.now()}-${Math.random().toString(16).slice(2)}.bin`;
  const spoolPath = path.join(spoolDir, fileName);
  await fs.mkdir(spoolDir, { recursive: true });
  await fs.writeFile(spoolPath, payloadBuffer);

  const args = ["-o", "raw"];
  if (printerName) {
    args.push("-d", printerName);
  }
  args.push(spoolPath);
  const { stdout, stderr } = await execFileAsync("lp", args);

  return {
    spoolPath,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, printerName, spoolDir }));
    return;
  }

  if (req.method !== "POST" || req.url !== "/print") {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ message: "Not found" }));
    return;
  }

  if (token) {
    const requestToken = req.headers["x-print-token"];
    if (requestToken !== token) {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ message: "Unauthorized" }));
      return;
    }
  }

  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const chunkBuffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += chunkBuffer.length;
    if (total > maxBodyBytes) {
      res.writeHead(413, { "content-type": "application/json" });
      res.end(JSON.stringify({ message: "Payload too large" }));
      return;
    }
    chunks.push(chunkBuffer);
  }

  try {
    const payload = Buffer.concat(chunks);
    const result = await queuePrint(payload);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        bytes: payload.length,
        spoolPath: result.spoolPath,
        lpStdout: result.stdout,
        lpStderr: result.stderr || null,
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Print relay error";
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, message }));
  }
});

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Print relay listening on http://0.0.0.0:${port}`);
});

const tcpServer = net.createServer((socket) => {
  const chunks = [];
  let total = 0;

  socket.on("data", (chunk) => {
    total += chunk.length;
    if (total > maxBodyBytes) {
      socket.destroy();
      return;
    }
    chunks.push(chunk);
  });

  socket.on("end", async () => {
    if (!chunks.length) return;
    try {
      await queuePrint(Buffer.concat(chunks));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("TCP relay print failed", error);
    }
  });
});

tcpServer.listen(tcpPort, () => {
  // eslint-disable-next-line no-console
  console.log(`Print relay TCP listening on 0.0.0.0:${tcpPort}`);
});
