import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types.js";
import { isAdmin } from "../services/rbac.js";

export const suppliersRouter = Router();
suppliersRouter.use(requireAuth);

const emptyToNull = z.string().transform((v) => v.trim() || null);

const supplierSchema = z.object({
  name: z.string().min(1).max(200),
  contactName: emptyToNull.pipe(z.string().max(200).nullable()).optional(),
  email: emptyToNull.pipe(z.string().email().max(200).nullable()).optional(),
  phone: emptyToNull.pipe(z.string().max(50).nullable()).optional(),
  website: emptyToNull.pipe(z.string().max(500).nullable()).optional(),
  address: emptyToNull.pipe(z.string().max(500).nullable()).optional(),
  notes: emptyToNull.pipe(z.string().max(2000).nullable()).optional(),
  isActive: z.boolean().optional(),
});

suppliersRouter.get("/", async (req: AuthenticatedRequest, res) => {
  const search = (req.query.search as string || "").trim().toLowerCase();
  const includeInactive = req.query.includeInactive === "true";

  const where: Record<string, unknown> = {};
  if (!includeInactive) where.isActive = true;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { contactName: { contains: search, mode: "insensitive" } },
    ];
  }

  const suppliers = await prisma.supplier.findMany({
    where,
    orderBy: { name: "asc" },
    include: { _count: { select: { items: true } } },
  });
  res.json(suppliers);
});

suppliersRouter.get("/:id", async (req: AuthenticatedRequest, res) => {
  const id = String(req.params.id);
  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: {
      items: { where: { isActive: true }, orderBy: { name: "asc" } },
    },
  });
  if (!supplier) return res.status(404).json({ error: "Supplier not found" });
  res.json(supplier);
});

suppliersRouter.post("/", async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  if (!isAdmin(user.roles)) return res.status(403).json({ error: "Admin only" });

  const parsed = supplierSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const supplier = await prisma.supplier.create({ data: parsed.data });
  res.status(201).json(supplier);
});

suppliersRouter.patch("/:id", async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  if (!isAdmin(user.roles)) return res.status(403).json({ error: "Admin only" });

  const id = String(req.params.id);
  const existing = await prisma.supplier.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Supplier not found" });

  const parsed = supplierSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const updated = await prisma.supplier.update({ where: { id }, data: parsed.data });
  res.json(updated);
});

suppliersRouter.delete("/:id", async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  if (!isAdmin(user.roles)) return res.status(403).json({ error: "Admin only" });

  const id = String(req.params.id);
  const existing = await prisma.supplier.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Supplier not found" });

  await prisma.supplier.update({ where: { id }, data: { isActive: false } });
  res.json({ ok: true });
});
