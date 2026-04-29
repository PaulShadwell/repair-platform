import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types.js";
import { isAdmin } from "../services/rbac.js";

export const analyticsRouter = Router();

// ---------------------------------------------------------------------------
// GET /analytics/overview — High-level stats (admin/supervisor only)
// ---------------------------------------------------------------------------
analyticsRouter.get("/overview", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!req.user || !(isAdmin(req.user.roles) || req.user.roles.includes("SUPERVISOR"))) {
    res.status(403).json({ message: "Access denied" });
    return;
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalRepairs,
    repairsLast30,
    repairsLast7,
    completedLast30,
    avgResolutionResult,
    statusBreakdown,
    outcomeBreakdown,
    articleTypeBreakdown,
    assigneeWorkload,
  ] = await Promise.all([
    prisma.repair.count(),
    prisma.repair.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.repair.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.repair.count({
      where: { status: "COMPLETED", completedAt: { gte: thirtyDaysAgo } },
    }),
    // Average resolution time (completed repairs with completedAt)
    prisma.$queryRaw<Array<{ avg_hours: number | null }>>`
      SELECT AVG(EXTRACT(EPOCH FROM ("completedAt" - "createdAt")) / 3600)::float AS avg_hours
      FROM "Repair"
      WHERE status = 'COMPLETED' AND "completedAt" IS NOT NULL AND "createdAt" IS NOT NULL
    `,
    // Status breakdown
    prisma.repair.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
    // Outcome breakdown (completed only)
    prisma.repair.groupBy({
      by: ["outcome"],
      where: { status: "COMPLETED", outcome: { not: null } },
      _count: { outcome: true },
    }),
    // Article type breakdown
    prisma.repair.groupBy({
      by: ["productType"],
      _count: { productType: true },
      orderBy: { _count: { productType: "desc" } },
      take: 10,
    }),
    // Assignee workload (active repairs only)
    prisma.repair.groupBy({
      by: ["assignedToUserId"],
      where: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
      _count: { id: true },
    }),
  ]);

  // Resolve assignee names
  const userIds = assigneeWorkload
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
    overview: {
      totalRepairs,
      repairsLast30,
      repairsLast7,
      completedLast30,
      avgResolutionHours: avgResolutionResult[0]?.avg_hours ?? null,
      statusBreakdown: statusBreakdown.map((row) => ({
        status: row.status,
        count: row._count.status,
      })),
      outcomeBreakdown: outcomeBreakdown.map((row) => ({
        outcome: row.outcome,
        count: row._count.outcome,
      })),
      articleTypeBreakdown: articleTypeBreakdown.map((row) => ({
        type: row.productType ?? "Unknown",
        count: row._count.productType,
      })),
      assigneeWorkload: assigneeWorkload.map((row) => ({
        assigneeId: row.assignedToUserId,
        assigneeName: row.assignedToUserId
          ? userMap.get(row.assignedToUserId) ?? "Unknown"
          : "Unassigned",
        activeCount: row._count.id,
      })),
    },
  });
});

// ---------------------------------------------------------------------------
// GET /analytics/trends — Repairs over time (last 30 days, daily)
// ---------------------------------------------------------------------------
analyticsRouter.get("/trends", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!req.user || !(isAdmin(req.user.roles) || req.user.roles.includes("SUPERVISOR"))) {
    res.status(403).json({ message: "Access denied" });
    return;
  }

  const days = Math.min(Number(req.query.days) || 30, 90);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const createdByDay = await prisma.$queryRaw<Array<{ day: string; count: string }>>`
    SELECT TO_CHAR("createdAt"::date, 'YYYY-MM-DD') AS day, COUNT(*)::text AS count
    FROM "Repair"
    WHERE "createdAt" >= ${since}
    GROUP BY "createdAt"::date
    ORDER BY "createdAt"::date
  `;

  const completedByDay = await prisma.$queryRaw<Array<{ day: string; count: string }>>`
    SELECT TO_CHAR("completedAt"::date, 'YYYY-MM-DD') AS day, COUNT(*)::text AS count
    FROM "Repair"
    WHERE "completedAt" IS NOT NULL AND "completedAt" >= ${since}
    GROUP BY "completedAt"::date
    ORDER BY "completedAt"::date
  `;

  // Build a full date range
  const dayMap = new Map<string, { created: number; completed: number }>();
  for (let d = new Date(since); d <= new Date(); d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    dayMap.set(key, { created: 0, completed: 0 });
  }
  for (const row of createdByDay) {
    const entry = dayMap.get(row.day);
    if (entry) entry.created = Number(row.count);
  }
  for (const row of completedByDay) {
    const entry = dayMap.get(row.day);
    if (entry) entry.completed = Number(row.count);
  }

  const trends = Array.from(dayMap.entries()).map(([day, counts]) => ({
    day,
    created: counts.created,
    completed: counts.completed,
  }));

  res.json({ trends });
});
