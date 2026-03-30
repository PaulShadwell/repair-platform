import fs from "node:fs/promises";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types.js";
import { resolvePhotoPath, storePhoto } from "../services/storage.js";

export const repairMaterialsRouter = Router({ mergeParams: true });
repairMaterialsRouter.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

const materialSchema = z.object({
  inventoryItemId: z.string().uuid().nullable().optional(),
  description: z.string().min(1).max(500),
  quantity: z.number().min(0).default(1),
  unitCost: z.number().min(0).default(0),
  billedToCustomer: z.boolean().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

function canManageMaterials(roles: string[]): boolean {
  return roles.some((r) => ["ADMIN", "SUPERVISOR", "REPAIRER"].includes(r));
}

const MATERIAL_INCLUDE = {
  inventoryItem: { select: { id: true, name: true, sku: true, category: true } },
  addedBy: { select: { id: true, fullName: true } },
} as const;

repairMaterialsRouter.get("/", async (req: AuthenticatedRequest, res) => {
  const repairId = String(req.params.repairId);
  const repair = await prisma.repair.findUnique({ where: { id: repairId } });
  if (!repair) return res.status(404).json({ error: "Repair not found" });

  const materials = await prisma.repairMaterial.findMany({
    where: { repairId },
    orderBy: { createdAt: "asc" },
    include: MATERIAL_INCLUDE,
  });
  res.json(materials);
});

repairMaterialsRouter.post("/", async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  if (!canManageMaterials(user.roles)) return res.status(403).json({ error: "Forbidden" });

  const repairId = String(req.params.repairId);
  const repair = await prisma.repair.findUnique({ where: { id: repairId } });
  if (!repair) return res.status(404).json({ error: "Repair not found" });

  const parsed = materialSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const totalCost = Number((parsed.data.quantity * parsed.data.unitCost).toFixed(2));

  const material = await prisma.repairMaterial.create({
    data: {
      repairId,
      inventoryItemId: parsed.data.inventoryItemId ?? null,
      description: parsed.data.description,
      quantity: parsed.data.quantity,
      unitCost: parsed.data.unitCost,
      totalCost,
      billedToCustomer: parsed.data.billedToCustomer ?? false,
      notes: parsed.data.notes ?? null,
      addedById: user.id,
    },
    include: MATERIAL_INCLUDE,
  });
  res.status(201).json(material);
});

repairMaterialsRouter.patch("/:materialId", async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  if (!canManageMaterials(user.roles)) return res.status(403).json({ error: "Forbidden" });

  const repairId = String(req.params.repairId);
  const materialId = String(req.params.materialId);
  const existing = await prisma.repairMaterial.findUnique({ where: { id: materialId } });
  if (!existing || existing.repairId !== repairId) {
    return res.status(404).json({ error: "Material not found" });
  }

  const parsed = materialSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const qty = parsed.data.quantity ?? Number(existing.quantity);
  const cost = parsed.data.unitCost ?? Number(existing.unitCost);
  const totalCost = Number((qty * cost).toFixed(2));

  const updated = await prisma.repairMaterial.update({
    where: { id: materialId },
    data: { ...parsed.data, totalCost },
    include: MATERIAL_INCLUDE,
  });
  res.json(updated);
});

repairMaterialsRouter.delete("/:materialId", async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  if (!canManageMaterials(user.roles)) return res.status(403).json({ error: "Forbidden" });

  const repairId = String(req.params.repairId);
  const materialId = String(req.params.materialId);
  const existing = await prisma.repairMaterial.findUnique({ where: { id: materialId } });
  if (!existing || existing.repairId !== repairId) {
    return res.status(404).json({ error: "Material not found" });
  }

  if (existing.receiptStorageKey) {
    const filePath = resolvePhotoPath(existing.receiptStorageKey);
    await fs.unlink(filePath).catch(() => {});
  }

  await prisma.repairMaterial.delete({ where: { id: materialId } });
  res.json({ ok: true });
});

repairMaterialsRouter.post(
  "/:materialId/receipt",
  upload.single("receipt"),
  async (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    if (!canManageMaterials(user.roles)) return res.status(403).json({ error: "Forbidden" });

    const repairId = String(req.params.repairId);
    const materialId = String(req.params.materialId);
    const existing = await prisma.repairMaterial.findUnique({ where: { id: materialId } });
    if (!existing || existing.repairId !== repairId) {
      return res.status(404).json({ error: "Material not found" });
    }

    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    if (existing.receiptStorageKey) {
      const oldPath = resolvePhotoPath(existing.receiptStorageKey);
      await fs.unlink(oldPath).catch(() => {});
    }

    const ext = file.originalname.split(".").pop()?.toLowerCase() || "bin";
    const stored = await storePhoto(file.buffer, ext);

    const updated = await prisma.repairMaterial.update({
      where: { id: materialId },
      data: {
        receiptStorageKey: stored.storageKey,
        receiptOriginalName: file.originalname,
      },
      include: MATERIAL_INCLUDE,
    });
    res.json(updated);
  },
);

repairMaterialsRouter.get("/:materialId/receipt", async (req: AuthenticatedRequest, res) => {
  const repairId = String(req.params.repairId);
  const materialId = String(req.params.materialId);
  const existing = await prisma.repairMaterial.findUnique({ where: { id: materialId } });
  if (!existing || existing.repairId !== repairId || !existing.receiptStorageKey) {
    return res.status(404).json({ error: "Receipt not found" });
  }

  const filePath = resolvePhotoPath(existing.receiptStorageKey);
  try {
    await fs.access(filePath);
  } catch {
    return res.status(404).json({ error: "Receipt file missing" });
  }

  res.sendFile(filePath);
});

repairMaterialsRouter.delete("/:materialId/receipt", async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  if (!canManageMaterials(user.roles)) return res.status(403).json({ error: "Forbidden" });

  const repairId = String(req.params.repairId);
  const materialId = String(req.params.materialId);
  const existing = await prisma.repairMaterial.findUnique({ where: { id: materialId } });
  if (!existing || existing.repairId !== repairId || !existing.receiptStorageKey) {
    return res.status(404).json({ error: "Receipt not found" });
  }

  const filePath = resolvePhotoPath(existing.receiptStorageKey);
  await fs.unlink(filePath).catch(() => {});

  await prisma.repairMaterial.update({
    where: { id: materialId },
    data: { receiptStorageKey: null, receiptOriginalName: null },
  });
  res.json({ ok: true });
});
