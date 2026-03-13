import { Router } from "express";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import prismaClientPackage from "@prisma/client";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types.js";
import { hasPermission } from "../services/rbac.js";

const { ConnectionType, Prisma } = prismaClientPackage;

const createPrinterSchema = z.object({
  name: z.string().min(1),
  connectionType: z.nativeEnum(ConnectionType),
  host: z.string().optional(),
  port: z.number().int().optional(),
  codePage: z.string().optional(),
  charsPerLine: z.number().int().min(24).max(64).optional(),
  cutAfterPrint: z.boolean().optional(),
  feedLines: z.number().int().min(0).max(10).optional(),
});

export const printersRouter = Router();
printersRouter.use(requireAuth);

printersRouter.get("/", async (req: AuthenticatedRequest, res) => {
  const printers = await prisma.printerProfile.findMany({ orderBy: { name: "asc" } });
  const result = printers.map((printer) => ({
    ...printer,
    hasActiveAgent: false,
    printerStatus: "UNKNOWN" as const,
    lastSuccessfulPrintAt: null as string | null,
    canGeneratePairCode: Boolean(req.user && hasPermission(req.user.roles, "repairs:assign")),
  }));

  try {
    const [recentlySeenAgents, recentSuccessLogs] = await Promise.all([
      prisma.printAgent.findMany({
        where: {
          isActive: true,
          lastSeenAt: {
            gt: new Date(Date.now() - (60 * 1000)),
          },
        },
        select: { printerProfileId: true },
        distinct: ["printerProfileId"],
      }),
      prisma.printLog.findMany({
        where: {
          success: true,
          printerProfileId: { not: null },
        },
        orderBy: { createdAt: "desc" },
        select: { printerProfileId: true, createdAt: true },
      }),
    ]);

    const activeSet = new Set(recentlySeenAgents.map((agent) => agent.printerProfileId));
    const lastSuccessByPrinter = new Map<string, string>();
    for (const log of recentSuccessLogs) {
      if (!log.printerProfileId || lastSuccessByPrinter.has(log.printerProfileId)) continue;
      lastSuccessByPrinter.set(log.printerProfileId, log.createdAt.toISOString());
    }

    res.json({
      printers: result.map((printer) => ({
        ...printer,
        hasActiveAgent: activeSet.has(printer.id),
        printerStatus: activeSet.has(printer.id) ? "ONLINE" : "OFFLINE",
        lastSuccessfulPrintAt: lastSuccessByPrinter.get(printer.id) ?? null,
      })),
    });
    return;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2021" &&
      typeof error.message === "string" &&
      error.message.includes("PrintAgent")
    ) {
      // In older DB schema states, return printers without agent status.
      res.json({ printers: result });
      return;
    }
    throw error;
  }
});

printersRouter.post("/", async (req: AuthenticatedRequest, res) => {
  if (!req.user || !hasPermission(req.user.roles, "repairs:assign")) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  const parsed = createPrinterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid payload" });
    return;
  }

  const printer = await prisma.printerProfile.create({ data: parsed.data });
  res.status(201).json({ printer });
});

printersRouter.post("/:id/pair-code", async (req: AuthenticatedRequest, res) => {
  if (!req.user || !hasPermission(req.user.roles, "repairs:assign")) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  const printerId = String(req.params.id);
  const printer = await prisma.printerProfile.findUnique({ where: { id: printerId } });
  if (!printer) {
    res.status(404).json({ message: "Printer profile not found" });
    return;
  }

  const code = randomBytes(4).toString("hex").toUpperCase();
  const expiresAt = new Date(Date.now() + (10 * 60 * 1000));
  const pairing = await prisma.printerPairingCode.create({
    data: {
      code,
      printerProfileId: printer.id,
      createdById: req.user.id,
      expiresAt,
    },
  });

  res.json({
    ok: true,
    pairingCode: pairing.code,
    expiresAt: pairing.expiresAt.toISOString(),
    printerProfileId: printer.id,
    printerName: printer.name,
  });
});
