import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types.js";
import { isAdmin } from "../services/rbac.js";

export const inventoryRouter = Router();
inventoryRouter.use(requireAuth);

const itemSchema = z.object({
  name: z.string().min(1).max(300),
  sku: z.string().max(100).nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  unitCost: z.number().min(0).nullable().optional(),
  unitLabel: z.string().max(20).optional(),
  supplierId: z.string().uuid().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
});

inventoryRouter.get("/", async (req: AuthenticatedRequest, res) => {
  const search = (req.query.search as string || "").trim().toLowerCase();
  const category = (req.query.category as string || "").trim();
  const includeInactive = req.query.includeInactive === "true";

  const where: Record<string, unknown> = {};
  if (!includeInactive) where.isActive = true;
  if (category) where.category = category;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { sku: { contains: search, mode: "insensitive" } },
    ];
  }

  const items = await prisma.inventoryItem.findMany({
    where,
    orderBy: { name: "asc" },
    include: { supplier: { select: { id: true, name: true } } },
  });
  res.json(items);
});

inventoryRouter.get("/categories", async (_req: AuthenticatedRequest, res) => {
  const raw = await prisma.inventoryItem.findMany({
    where: { category: { not: null }, isActive: true },
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });
  res.json(raw.map((r) => r.category).filter(Boolean));
});

inventoryRouter.get("/:id", async (req: AuthenticatedRequest, res) => {
  const id = String(req.params.id);
  const item = await prisma.inventoryItem.findUnique({
    where: { id },
    include: { supplier: { select: { id: true, name: true } } },
  });
  if (!item) return res.status(404).json({ error: "Item not found" });
  res.json(item);
});

inventoryRouter.post("/", async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  if (!isAdmin(user.roles)) return res.status(403).json({ error: "Admin only" });

  const parsed = itemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const data: Record<string, unknown> = { ...parsed.data };
  if (data.unitCost !== undefined && data.unitCost !== null) {
    data.unitCost = Number(data.unitCost);
  }

  const item = await prisma.inventoryItem.create({
    data: data as Parameters<typeof prisma.inventoryItem.create>[0]["data"],
    include: { supplier: { select: { id: true, name: true } } },
  });
  res.status(201).json(item);
});

inventoryRouter.patch("/:id", async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  if (!isAdmin(user.roles)) return res.status(403).json({ error: "Admin only" });

  const id = String(req.params.id);
  const existing = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Item not found" });

  const parsed = itemSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const data: Record<string, unknown> = { ...parsed.data };
  if (data.unitCost !== undefined && data.unitCost !== null) {
    data.unitCost = Number(data.unitCost);
  }

  const item = await prisma.inventoryItem.update({
    where: { id },
    data: data as Parameters<typeof prisma.inventoryItem.update>[0]["data"],
    include: { supplier: { select: { id: true, name: true } } },
  });
  res.json(item);
});

inventoryRouter.delete("/:id", async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  if (!isAdmin(user.roles)) return res.status(403).json({ error: "Admin only" });

  const id = String(req.params.id);
  const existing = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Item not found" });

  await prisma.inventoryItem.update({ where: { id }, data: { isActive: false } });
  res.json({ ok: true });
});
