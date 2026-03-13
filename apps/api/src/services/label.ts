import net from "node:net";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createCanvas } from "@napi-rs/canvas";
import EscPosEncoder from "esc-pos-encoder";
import QRCode from "qrcode";
import type { PrinterProfile, Repair } from "@prisma/client";
import { config } from "../config.js";

type PrintableRepair = Repair & {
  assignedToName?: string | null;
};

type LabelOptions = {
  charsPerLine?: number;
  cutAfterPrint?: boolean;
  feedLines?: number;
};

function wrapText(value: string, maxWidth: number): string[] {
  const clean = value.trim();
  if (!clean) return [""];
  const words = clean.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    if (word.length <= maxWidth) {
      current = word;
      continue;
    }
    // Hard-wrap very long tokens
    let index = 0;
    while (index < word.length) {
      const chunk = word.slice(index, index + maxWidth);
      if (chunk.length === maxWidth) {
        lines.push(chunk);
      } else {
        current = chunk;
      }
      index += maxWidth;
    }
    if (index >= word.length && word.length % maxWidth === 0) {
      current = "";
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function buildLabelPayloadText(repair: PrintableRepair, options: LabelOptions = {}): Buffer {
  const encoder = new EscPosEncoder();
  const url = `${config.publicBaseUrl}/repairs/${repair.publicRef}`;
  const charsPerLine = Math.max(24, Math.min(64, options.charsPerLine ?? 40));
  const leftWidth = Math.min(16, Math.max(10, Math.floor(charsPerLine * 0.36)));
  const valueWidth = Math.max(8, charsPerLine - leftWidth - 5);
  const cutAfterPrint = options.cutAfterPrint ?? true;
  const feedLines = Math.max(2, options.feedLines ?? 4);
  const product = repair.itemName ?? "";
  const problem = repair.problemDescription ?? "";
  const createdDate = repair.createdDate
    ? repair.createdDate.toLocaleDateString("de-CH")
    : "";
  const completedDate = repair.completedAt
    ? repair.completedAt.toLocaleDateString("de-CH")
    : "";

  const boolBox = (value: boolean | null) => (value ? "[x]" : "[ ]");
  const fullWidth = Math.max(10, leftWidth + valueWidth + 5);
  const tableBorder = `+${"-".repeat(leftWidth + 2)}+${"-".repeat(valueWidth + 2)}+`;
  const divider = `+${"=".repeat(fullWidth - 2)}+`;

  const printRule = (useDouble = false) => {
    encoder.line(useDouble ? divider : tableBorder);
  };

  const padRight = (value: string, width: number) => {
    if (value.length >= width) return value.slice(0, width);
    return value.padEnd(width, " ");
  };

  const printField = (label: string, value: string) => {
    const labelLines = wrapText(label, leftWidth);
    const valueLines = wrapText(value, valueWidth);
    const rowCount = Math.max(labelLines.length, valueLines.length);
    for (let i = 0; i < rowCount; i += 1) {
      const left = labelLines[i] ?? "";
      const right = valueLines[i] ?? "";
      encoder.line(`| ${padRight(left, leftWidth)} | ${padRight(right, valueWidth)} |`);
    }
  };

  encoder.initialize();
  encoder.align("center");
  encoder.line("Reparatur");
  encoder.newline();
  encoder.line(repair.repairNumber ? String(repair.repairNumber) : repair.publicRef);
  encoder.newline();

  // Some thermal models do not support the QR command set; skip silently if unsupported.
  try {
    encoder.qrcode(url, { model: 2, size: 4, errorlevel: "m" });
    encoder.newline();
  } catch {
    try {
      encoder.qrcode(url, { size: 4, errorlevel: "m" });
      encoder.newline();
    } catch {
      // Keep URL text fallback below.
    }
  }

  encoder.align("left");
  printRule();
  printField("Datum", createdDate);
  printRule();
  printField("Produkt", product);
  printRule();
  printField("Problem", problem);
  printRule();
  printField("Techniker", repair.assignedToName ?? "");
  printRule();
  printField("Datum erledigt", completedDate);
  printRule();
  printField("Fix", repair.fixDescription ?? "");
  printRule();
  printField("Gelungen?", boolBox(repair.successful));
  printRule();
  printField("Sicherheitstest?", boolBox(repair.safetyTested));
  printRule(true);
  printField("Ref", repair.publicRef);
  printRule();
  wrapText(url, charsPerLine).forEach((line) => encoder.line(line));
  for (let i = 0; i < feedLines; i += 1) {
    encoder.newline();
  }
  if (cutAfterPrint) {
    encoder.cut();
  }

  return Buffer.from(encoder.encode());
}

function wrapTextByPixels(ctx: { measureText: (text: string) => { width: number } }, value: string, maxWidth: number): string[] {
  const clean = value.trim();
  if (!clean) return [""];
  const words = clean.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    if (ctx.measureText(word).width <= maxWidth) {
      current = word;
      continue;
    }
    let chunk = "";
    for (const char of word) {
      const next = `${chunk}${char}`;
      if (ctx.measureText(next).width <= maxWidth) {
        chunk = next;
      } else {
        if (chunk) lines.push(chunk);
        chunk = char;
      }
    }
    current = chunk;
  }

  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function drawQrMatrix(
  ctx: {
    fillStyle: unknown;
    fillRect: (x: number, y: number, w: number, h: number) => void;
  },
  value: string,
  x: number,
  y: number,
  size: number,
): void {
  const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
  const modules = qr.modules.size;
  const data = qr.modules.data as ArrayLike<number>;
  const moduleSize = Math.max(2, Math.floor(size / modules));
  const qrSize = moduleSize * modules;
  const offsetX = x + Math.floor((size - qrSize) / 2);
  const offsetY = y + Math.floor((size - qrSize) / 2);

  ctx.fillStyle = "#fff";
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = "#000";
  for (let row = 0; row < modules; row += 1) {
    for (let col = 0; col < modules; col += 1) {
      const index = row * modules + col;
      if (data[index]) {
        ctx.fillRect(offsetX + (col * moduleSize), offsetY + (row * moduleSize), moduleSize, moduleSize);
      }
    }
  }
}

function buildLabelPayloadBitmap(repair: PrintableRepair, options: LabelOptions = {}): Buffer {
  const encoder = new EscPosEncoder();
  const url = `${config.publicBaseUrl}/repairs/${repair.publicRef}`;
  const charsPerLine = Math.max(24, Math.min(64, options.charsPerLine ?? 40));
  const cutAfterPrint = options.cutAfterPrint ?? true;
  const feedLines = Math.max(2, options.feedLines ?? 4);

  const canvasWidth = charsPerLine <= 40 ? 576 : 640;
  const margin = 12;
  const tableWidth = canvasWidth - (margin * 2);
  const leftColWidth = Math.floor(tableWidth * 0.39);
  const rightColWidth = tableWidth - leftColWidth;

  const canvas = createCanvas(canvasWidth, 2200);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000";
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2;
  ctx.textBaseline = "top";

  const rowPadding = 6;
  const lineHeight = 26;
  const leftFontSize = 20;
  const rightFontSize = 24;

  const drawTwoColRow = (
    left: string,
    right: string,
    y: number,
    opts: { boldLeft?: boolean; boldRight?: boolean; minHeight?: number; leftSize?: number; rightSize?: number } = {},
  ): number => {
    const drawLeftSize = opts.leftSize ?? leftFontSize;
    const drawRightSize = opts.rightSize ?? rightFontSize;
    ctx.font = `${opts.boldLeft ? "700" : "500"} ${drawLeftSize}px "DejaVu Sans", sans-serif`;
    const leftLines = wrapTextByPixels(ctx, left, leftColWidth - (rowPadding * 2));
    ctx.font = `${opts.boldRight ? "700" : "500"} ${drawRightSize}px "DejaVu Sans", sans-serif`;
    const rightLines = wrapTextByPixels(ctx, right, rightColWidth - (rowPadding * 2));
    const maxLines = Math.max(leftLines.length, rightLines.length);
    const rowHeight = Math.max(opts.minHeight ?? 0, rowPadding * 2 + maxLines * lineHeight);

    ctx.strokeRect(margin, y, tableWidth, rowHeight);
    ctx.beginPath();
    ctx.moveTo(margin + leftColWidth, y);
    ctx.lineTo(margin + leftColWidth, y + rowHeight);
    ctx.stroke();

    ctx.font = `${opts.boldLeft ? "700" : "500"} ${drawLeftSize}px "DejaVu Sans", sans-serif`;
    leftLines.forEach((line, index) => {
      ctx.fillText(line, margin + rowPadding, y + rowPadding + (index * lineHeight));
    });

    ctx.font = `${opts.boldRight ? "700" : "500"} ${drawRightSize}px "DejaVu Sans", sans-serif`;
    rightLines.forEach((line, index) => {
      ctx.fillText(line, margin + leftColWidth + rowPadding, y + rowPadding + (index * lineHeight));
    });

    return y + rowHeight;
  };

  const drawFullRow = (value: string, y: number, bold = false): number => {
    ctx.font = `${bold ? "700" : "500"} ${leftFontSize}px "DejaVu Sans", sans-serif`;
    const lines = wrapTextByPixels(ctx, value, tableWidth - (rowPadding * 2));
    const rowHeight = Math.max(30, rowPadding * 2 + lines.length * lineHeight);
    ctx.strokeRect(margin, y, tableWidth, rowHeight);
    lines.forEach((line, index) => {
      ctx.fillText(line, margin + rowPadding, y + rowPadding + (index * lineHeight));
    });
    return y + rowHeight;
  };

  let y = margin;

  y = drawTwoColRow("Reparatur", repair.repairNumber ? String(repair.repairNumber) : repair.publicRef, y, {
    boldLeft: true,
    boldRight: true,
    minHeight: 72,
    leftSize: 20,
    rightSize: 36,
  });

  const qrRowHeight = 220;
  ctx.strokeRect(margin, y, tableWidth, qrRowHeight);
  ctx.beginPath();
  ctx.moveTo(margin + leftColWidth, y);
  ctx.lineTo(margin + leftColWidth, y + qrRowHeight);
  ctx.stroke();
  drawQrMatrix(ctx, url, margin + leftColWidth + 20, y + 20, qrRowHeight - 40);
  y += qrRowHeight;

  const createdDate = repair.createdDate ? repair.createdDate.toLocaleDateString("de-CH") : "";
  const completedDate = repair.completedAt ? repair.completedAt.toLocaleDateString("de-CH") : "";
  const boolBox = (value: boolean | null) => (value ? "[x]" : "[ ]");

  y = drawTwoColRow("Datum", createdDate, y, { boldLeft: true });
  y = drawTwoColRow("Produkt", repair.itemName ?? "", y, { boldLeft: true });
  y = drawTwoColRow("Problem", repair.problemDescription ?? "", y, { boldLeft: true });
  y = drawTwoColRow("Techniker", repair.assignedToName ?? "", y, { boldLeft: true });
  y = drawTwoColRow("Datum erledigt / Fix", `${completedDate} ${repair.fixDescription ?? ""}`.trim(), y, {
    boldLeft: true,
  });
  y = drawTwoColRow("Gelungen?", boolBox(repair.successful), y, { boldLeft: true });
  y = drawTwoColRow("Sicherheitstest gemacht?", boolBox(repair.safetyTested), y, { boldLeft: true });
  y = drawFullRow(`Ref: ${repair.publicRef}`, y);

  const rawHeight = y + margin;
  const finalHeight = Math.ceil(rawHeight / 8) * 8;
  if (finalHeight > rawHeight) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, rawHeight, canvasWidth, finalHeight - rawHeight);
  }
  const imageData = ctx.getImageData(0, 0, canvasWidth, finalHeight);

  encoder.initialize();
  encoder.align("left");
  encoder.image(imageData, canvasWidth, finalHeight, "threshold");
  for (let i = 0; i < feedLines; i += 1) {
    encoder.newline();
  }
  if (cutAfterPrint) {
    encoder.cut();
  }

  return Buffer.from(encoder.encode());
}

export function buildLabelPayload(repair: PrintableRepair, options: LabelOptions = {}): Buffer {
  try {
    return buildLabelPayloadBitmap(repair, options);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Bitmap label render failed, falling back to text payload", error);
    return buildLabelPayloadText(repair, options);
  }
}

const execFileAsync = promisify(execFile);

async function writeSpoolFile(payload: Buffer): Promise<string> {
  const fileName = `${Date.now()}-${Math.random().toString(16).slice(2)}.bin`;
  const spoolPath = path.join(config.printSpoolDir, fileName);
  await fs.mkdir(config.printSpoolDir, { recursive: true });
  await fs.writeFile(spoolPath, payload);
  return spoolPath;
}

async function printViaSystemQueue(payload: Buffer): Promise<{ sent: boolean; spoolPath: string }> {
  const spoolPath = await writeSpoolFile(payload);
  const args = ["-o", "raw"];
  if (config.systemPrinterName) {
    args.push("-d", config.systemPrinterName);
  }
  args.push(spoolPath);
  await execFileAsync("lp", args);
  return { sent: true, spoolPath };
}

async function printViaRelay(payload: Buffer): Promise<{ sent: boolean; spoolPath?: string }> {
  if (!config.printRelayUrl) {
    throw new Error("PRINT_RELAY_URL is required when DEFAULT_PRINTER_MODE=relay");
  }
  const headers: Record<string, string> = {
    "content-type": "application/octet-stream",
  };
  if (config.printRelayToken) {
    headers["x-print-token"] = config.printRelayToken;
  }

  const response = await fetch(config.printRelayUrl, {
    method: "POST",
    headers,
    body: new Uint8Array(payload),
    signal: AbortSignal.timeout(config.printRelayTimeoutMs),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Relay print failed (${response.status})${text ? `: ${text}` : ""}`);
  }

  const data = await response
    .json()
    .catch(() => null) as { spoolPath?: string | null } | null;
  return { sent: true, spoolPath: data?.spoolPath ?? undefined };
}

async function printViaRelayUrl(
  relayUrl: string,
  payload: Buffer,
): Promise<{ sent: boolean; spoolPath?: string }> {
  const normalized = relayUrl.trim().replace(/\/+$/, "");
  const url = normalized.endsWith("/print") ? normalized : `${normalized}/print`;
  const headers: Record<string, string> = {
    "content-type": "application/octet-stream",
  };
  if (config.printRelayToken) {
    headers["x-print-token"] = config.printRelayToken;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: new Uint8Array(payload),
    signal: AbortSignal.timeout(config.printRelayTimeoutMs),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Relay URL print failed (${response.status})${text ? `: ${text}` : ""}`);
  }
  const data = await response
    .json()
    .catch(() => null) as { spoolPath?: string | null } | null;
  return { sent: true, spoolPath: data?.spoolPath ?? undefined };
}

export async function printPayload(
  payload: Buffer,
  printer: PrinterProfile | null,
): Promise<{ sent: boolean; spoolPath?: string }> {
  const defaultMode = (config.defaultPrinterMode ?? "spool").toLowerCase();
  if (!printer) {
    if (defaultMode === "relay") {
      return printViaRelay(payload);
    }
    if (defaultMode === "system") {
      return printViaSystemQueue(payload);
    }
    const spoolPath = await writeSpoolFile(payload);
    return { sent: true, spoolPath };
  }

  if (printer.connectionType === "SPOOL") {
    const spoolPath = await writeSpoolFile(payload);
    return { sent: true, spoolPath };
  }

  if (printer.host && /^https?:\/\//i.test(printer.host)) {
    return printViaRelayUrl(printer.host, payload);
  }

  if (!printer.host || !printer.port) {
    throw new Error("TCP printer profile requires host and port");
  }

  await new Promise<void>((resolve, reject) => {
    const socket = net.createConnection({ host: printer.host!, port: printer.port! }, () => {
      socket.write(payload);
      socket.end();
    });
    socket.on("error", reject);
    socket.on("close", () => resolve());
  });

  return { sent: true };
}
