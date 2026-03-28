import { Router } from "express";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types.js";
import { isAdmin } from "../services/rbac.js";
import { config } from "../config.js";

export const brandingRouter = Router();

const BRANDING_KEYS = ["appName", "logoKey"] as const;
const LOGO_DIR = path.join(config.photoStorageDir, "_branding");
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

brandingRouter.get("/", async (_req, res) => {
  const rows = await prisma.siteSetting.findMany({
    where: { key: { in: [...BRANDING_KEYS] } },
  });
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  res.json(map);
});

brandingRouter.get("/logo", async (_req, res) => {
  const row = await prisma.siteSetting.findUnique({ where: { key: "logoKey" } });
  if (!row) {
    res.status(404).json({ message: "No custom logo" });
    return;
  }
  const filePath = path.join(LOGO_DIR, row.value);
  try {
    await fs.access(filePath);
  } catch {
    res.status(404).json({ message: "Logo file missing" });
    return;
  }
  const ext = path.extname(row.value).toLowerCase();
  const mime =
    ext === ".svg" ? "image/svg+xml" :
    ext === ".png" ? "image/png" :
    ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" :
    ext === ".webp" ? "image/webp" :
    ext === ".gif" ? "image/gif" :
    "application/octet-stream";
  res.setHeader("Content-Type", mime);
  res.setHeader("Cache-Control", "public, max-age=3600");
  const data = await fs.readFile(filePath);
  res.send(data);
});

const updateSchema = z.object({
  appName: z.string().min(1).max(100).optional(),
});

brandingRouter.put("/", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!isAdmin(req.user!.roles)) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid payload" });
    return;
  }
  const updates: { key: string; value: string }[] = [];
  if (parsed.data.appName !== undefined) {
    updates.push({ key: "appName", value: parsed.data.appName });
  }
  for (const u of updates) {
    await prisma.siteSetting.upsert({
      where: { key: u.key },
      create: { key: u.key, value: u.value },
      update: { value: u.value },
    });
  }
  const rows = await prisma.siteSetting.findMany({
    where: { key: { in: [...BRANDING_KEYS] } },
  });
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  res.json(map);
});

brandingRouter.post("/logo", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!isAdmin(req.user!.roles)) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  const contentType = req.headers["content-type"] ?? "";
  if (!contentType.startsWith("image/")) {
    res.status(400).json({ message: "Content-Type must be an image/*" });
    return;
  }

  const chunks: Buffer[] = [];
  let totalSize = 0;

  for await (const chunk of req) {
    totalSize += (chunk as Buffer).length;
    if (totalSize > MAX_LOGO_BYTES) {
      res.status(413).json({ message: "Logo too large (max 2 MB)" });
      return;
    }
    chunks.push(chunk as Buffer);
  }

  const buffer = Buffer.concat(chunks);
  if (buffer.length === 0) {
    res.status(400).json({ message: "Empty body" });
    return;
  }

  const extMap: Record<string, string> = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/svg+xml": ".svg",
    "image/webp": ".webp",
    "image/gif": ".gif",
  };
  const ext = extMap[contentType] ?? ".png";
  const filename = `logo${ext}`;

  await fs.mkdir(LOGO_DIR, { recursive: true });

  const prev = await prisma.siteSetting.findUnique({ where: { key: "logoKey" } });
  if (prev) {
    try {
      await fs.unlink(path.join(LOGO_DIR, prev.value));
    } catch { /* ignore */ }
  }

  await fs.writeFile(path.join(LOGO_DIR, filename), buffer);

  await prisma.siteSetting.upsert({
    where: { key: "logoKey" },
    create: { key: "logoKey", value: filename },
    update: { value: filename },
  });

  res.json({ logoKey: filename });
});

brandingRouter.delete("/logo", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!isAdmin(req.user!.roles)) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }
  const row = await prisma.siteSetting.findUnique({ where: { key: "logoKey" } });
  if (row) {
    try {
      await fs.unlink(path.join(LOGO_DIR, row.value));
    } catch { /* ignore */ }
    await prisma.siteSetting.delete({ where: { key: "logoKey" } });
  }
  res.json({ ok: true });
});
