import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types.js";
import { hasPermission, isAdmin } from "../services/rbac.js";

export const customersRouter = Router();
customersRouter.use(requireAuth);

const listQuerySchema = z.object({
  search: z.string().trim().optional().default(""),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(25),
});

customersRouter.get("/", async (req: AuthenticatedRequest, res) => {
  if (!hasPermission(req.user!.roles, "repairs:view_all")) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  const parsed = listQuerySchema.safeParse(req.query ?? {});
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid query" });
    return;
  }

  const { search, page, pageSize } = parsed.data;

  const where = search.length >= 2
    ? {
        OR: [
          { firstName: { contains: search, mode: "insensitive" as const } },
          { lastName: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
          { phone: { contains: search } },
          { city: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [total, customers] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      include: {
        repairs: {
          select: {
            id: true,
            publicRef: true,
            repairNumber: true,
            status: true,
            itemName: true,
            createdDate: true,
            notified: true,
          },
          orderBy: { createdDate: "desc" },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  res.json({
    customers,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
});

const mergeSchema = z.object({
  keepId: z.string().uuid(),
  mergeIds: z.array(z.string().uuid()).min(1),
});

customersRouter.post("/merge", async (req: AuthenticatedRequest, res) => {
  if (!isAdmin(req.user!.roles)) {
    res.status(403).json({ message: "Only admins can merge customers" });
    return;
  }

  const parsed = mergeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid payload" });
    return;
  }

  const { keepId, mergeIds } = parsed.data;

  if (mergeIds.includes(keepId)) {
    res.status(400).json({ message: "keepId must not appear in mergeIds" });
    return;
  }

  const keep = await prisma.customer.findUnique({ where: { id: keepId } });
  if (!keep) {
    res.status(404).json({ message: "Primary customer not found" });
    return;
  }

  const toMerge = await prisma.customer.findMany({
    where: { id: { in: mergeIds } },
    select: { id: true },
  });
  const foundIds = new Set(toMerge.map((c) => c.id));
  const missing = mergeIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    res.status(404).json({ message: `Customer(s) not found: ${missing.join(", ")}` });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.repair.updateMany({
      where: { customerId: { in: mergeIds } },
      data: { customerId: keepId },
    });
    await tx.customer.deleteMany({
      where: { id: { in: mergeIds } },
    });
  });

  const updated = await prisma.customer.findUnique({
    where: { id: keepId },
    include: {
      repairs: {
        select: {
          id: true,
          publicRef: true,
          repairNumber: true,
          status: true,
          itemName: true,
          createdDate: true,
          notified: true,
        },
        orderBy: { createdDate: "desc" },
      },
    },
  });

  res.json({ customer: updated });
});
