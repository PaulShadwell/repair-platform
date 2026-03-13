import { Router } from "express";
import prismaClientPackage from "@prisma/client";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types.js";
import { isAdmin } from "../services/rbac.js";

const { RepairStatus } = prismaClientPackage;

export const dashboardRouter = Router();

dashboardRouter.get("/metrics", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!req.user || !isAdmin(req.user.roles)) {
    res.status(403).json({ message: "Only admins can view dashboard metrics" });
    return;
  }

  const [totalRepairs, completedRepairs, openRepairs, statusBreakdown, assigneeBreakdown] =
    await Promise.all([
      prisma.repair.count(),
      prisma.repair.count({ where: { status: RepairStatus.COMPLETED } }),
      prisma.repair.count({
        where: {
          status: { notIn: [RepairStatus.COMPLETED, RepairStatus.CANCELLED] },
        },
      }),
      prisma.repair.groupBy({
        by: ["status"],
        _count: { status: true },
      }),
      prisma.repair.groupBy({
        by: ["assignedToUserId"],
        _count: { id: true },
      }),
    ]);

  const userIds = assigneeBreakdown
    .map((x) => x.assignedToUserId)
    .filter((x): x is string => Boolean(x));
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, fullName: true },
      })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u.fullName]));

  res.json({
    metrics: {
      totalRepairs,
      completedRepairs,
      openRepairs,
      statusBreakdown: statusBreakdown.map((row) => ({
        status: row.status,
        count: row._count.status,
      })),
      assigneeBreakdown: assigneeBreakdown.map((row) => ({
        assigneeId: row.assignedToUserId,
        assigneeName: row.assignedToUserId ? userMap.get(row.assignedToUserId) ?? "Unknown" : "Unassigned",
        count: row._count.id,
      })),
    },
  });
});
