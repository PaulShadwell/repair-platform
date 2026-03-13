import { randomBytes } from "node:crypto";
import { Router } from "express";
import type { Request } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";

const pairSchema = z.object({
  code: z.string().min(4).max(32),
  agentName: z.string().min(1).max(80),
});

const completeSchema = z.object({
  success: z.boolean(),
  errorMessage: z.string().max(500).optional(),
});

function readAgentToken(req: Request): string | null {
  const value = req.headers["x-agent-token"];
  return typeof value === "string" && value ? value : null;
}

export const printAgentRouter = Router();

printAgentRouter.post("/pair", async (req, res) => {
  const parsed = pairSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid payload" });
    return;
  }

  const now = new Date();
  const pairing = await prisma.printerPairingCode.findFirst({
    where: {
      code: parsed.data.code,
      usedAt: null,
      expiresAt: { gt: now },
    },
  });
  if (!pairing) {
    res.status(404).json({ message: "Pairing code invalid or expired" });
    return;
  }

  const token = randomBytes(24).toString("hex");
  const [agent] = await prisma.$transaction([
    prisma.printAgent.create({
      data: {
        name: parsed.data.agentName,
        token,
        printerProfileId: pairing.printerProfileId,
        lastSeenAt: now,
      },
    }),
    prisma.printerPairingCode.update({
      where: { id: pairing.id },
      data: { usedAt: now },
    }),
  ]);

  res.json({
    ok: true,
    agent: {
      id: agent.id,
      name: agent.name,
      printerProfileId: agent.printerProfileId,
      token: agent.token,
    },
  });
});

printAgentRouter.post("/jobs/next", async (req, res) => {
  const token = readAgentToken(req);
  if (!token) {
    res.status(401).json({ message: "Missing agent token" });
    return;
  }

  const agent = await prisma.printAgent.findUnique({ where: { token } });
  if (!agent || !agent.isActive) {
    res.status(401).json({ message: "Agent not authorized" });
    return;
  }

  const now = new Date();
  await prisma.printAgent.update({
    where: { id: agent.id },
    data: { lastSeenAt: now },
  });

  const pending = await prisma.printJob.findFirst({
    where: {
      printerProfileId: agent.printerProfileId,
      status: "PENDING",
    },
    orderBy: { createdAt: "asc" },
  });

  if (!pending) {
    res.json({ job: null });
    return;
  }

  const claimed = await prisma.printJob.updateMany({
    where: {
      id: pending.id,
      status: "PENDING",
    },
    data: {
      status: "PROCESSING",
      agentId: agent.id,
      claimedAt: now,
    },
  });

  if (claimed.count === 0) {
    res.json({ job: null });
    return;
  }

  res.json({
    job: {
      id: pending.id,
      repairId: pending.repairId,
      payloadBase64: Buffer.from(pending.payload).toString("base64"),
    },
  });
});

printAgentRouter.post("/jobs/:jobId/complete", async (req, res) => {
  const token = readAgentToken(req);
  if (!token) {
    res.status(401).json({ message: "Missing agent token" });
    return;
  }

  const agent = await prisma.printAgent.findUnique({ where: { token } });
  if (!agent || !agent.isActive) {
    res.status(401).json({ message: "Agent not authorized" });
    return;
  }

  const parsed = completeSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid payload" });
    return;
  }

  const jobId = String(req.params.jobId);
  const existing = await prisma.printJob.findUnique({ where: { id: jobId } });
  if (!existing || existing.agentId !== agent.id || existing.status !== "PROCESSING") {
    res.status(404).json({ message: "Job not found" });
    return;
  }

  await prisma.printJob.update({
    where: { id: existing.id },
    data: {
      status: parsed.data.success ? "COMPLETED" : "FAILED",
      errorMessage: parsed.data.success ? null : (parsed.data.errorMessage ?? "Agent print failed"),
      completedAt: new Date(),
    },
  });

  await prisma.printAgent.update({
    where: { id: agent.id },
    data: { lastSeenAt: new Date() },
  });

  res.json({ ok: true });
});
