import { Router } from "express";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { config } from "../config.js";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types.js";
import { isMailerConfigured, sendPasswordResetEmail } from "../services/mailer.js";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  username: z.string().min(1),
});

const resetPasswordSchema = z.object({
  token: z.string().min(12),
  newPassword: z
    .string()
    .min(8)
    .regex(/[A-Za-z]/, "Password must include at least one letter")
    .regex(/[0-9]/, "Password must include at least one number"),
});

const FORGOT_WINDOW_MS = 15 * 60 * 1000;
const FORGOT_MAX_ATTEMPTS = 5;
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
const forgotAttempts = new Map<string, number[]>();

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function canAttemptForgot(key: string): boolean {
  const now = Date.now();
  const existing = forgotAttempts.get(key) ?? [];
  const withinWindow = existing.filter((value) => now - value < FORGOT_WINDOW_MS);
  if (withinWindow.length >= FORGOT_MAX_ATTEMPTS) {
    forgotAttempts.set(key, withinWindow);
    return false;
  }
  withinWindow.push(now);
  forgotAttempts.set(key, withinWindow);
  return true;
}

function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function isMissingColumnError(error: unknown, columnName: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2022" &&
    typeof error.message === "string" &&
    error.message.includes(columnName)
  );
}

function isMissingTableError(error: unknown, tableName: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021" &&
    typeof error.message === "string" &&
    error.message.includes(tableName)
  );
}

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid payload" });
    return;
  }

  let user:
    | {
        id: string;
        username: string;
        fullName: string;
        passwordHash: string;
        isActive: boolean;
        forcePasswordChange: boolean;
        roles: Array<{ role: { key: string } }>;
      }
    | {
        id: string;
        username: string;
        fullName: string;
        passwordHash: string;
        isActive: boolean;
        roles: Array<{ role: { key: string } }>;
      }
    | null = null;
  try {
    user = await prisma.user.findUnique({
      where: { username: parsed.data.username },
      select: {
        id: true,
        username: true,
        fullName: true,
        passwordHash: true,
        isActive: true,
        forcePasswordChange: true,
        roles: { select: { role: { select: { key: true } } } },
      },
    });
  } catch (error) {
    if (!isMissingColumnError(error, "forcePasswordChange")) {
      throw error;
    }
    user = await prisma.user.findUnique({
      where: { username: parsed.data.username },
      select: {
        id: true,
        username: true,
        fullName: true,
        passwordHash: true,
        isActive: true,
        roles: { select: { role: { select: { key: true } } } },
      },
    });
  }

  if (!user || !user.isActive) {
    res.status(401).json({ message: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ message: "Invalid credentials" });
    return;
  }

  const roles = user.roles.map((r) => r.role.key);
  const token = jwt.sign(
    { sub: user.id, username: user.username, fullName: user.fullName, roles },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn as SignOptions["expiresIn"] },
  );

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      roles,
      mustChangePassword: "forcePasswordChange" in user ? user.forcePasswordChange : false,
    },
  });
});

authRouter.get("/me", requireAuth, async (req: AuthenticatedRequest, res) => {
  let user:
    | {
        id: string;
        username: string;
        fullName: string;
        isActive: boolean;
        forcePasswordChange: boolean;
        roles: Array<{ role: { key: string } }>;
      }
    | {
        id: string;
        username: string;
        fullName: string;
        isActive: boolean;
        roles: Array<{ role: { key: string } }>;
      }
    | null = null;
  try {
    user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        username: true,
        fullName: true,
        isActive: true,
        forcePasswordChange: true,
        roles: { select: { role: { select: { key: true } } } },
      },
    });
  } catch (error) {
    if (!isMissingColumnError(error, "forcePasswordChange")) {
      throw error;
    }
    user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        username: true,
        fullName: true,
        isActive: true,
        roles: { select: { role: { select: { key: true } } } },
      },
    });
  }
  if (!user || !user.isActive) {
    res.status(401).json({ message: "User not found or inactive" });
    return;
  }
  res.json({
    user: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      roles: user.roles.map((r) => r.role.key),
      mustChangePassword: "forcePasswordChange" in user ? user.forcePasswordChange : false,
    },
  });
});

authRouter.post("/forgot-password", async (req, res) => {
  if (!isMailerConfigured()) {
    res.status(503).json({ message: "Password reset email service is not configured" });
    return;
  }

  const parsed = forgotPasswordSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    await wait(500);
    res.status(400).json({ message: "Invalid payload" });
    return;
  }

  const key = `${normalize(req.ip)}|${normalize(parsed.data.username)}`;
  if (!canAttemptForgot(key)) {
    await wait(500);
    res.status(429).json({ message: "Too many reset attempts. Try again later." });
    return;
  }

  let user:
    | { id: string; isActive: boolean; username: string; recoveryEmail: string | null }
    | null = null;
  try {
    user = await prisma.user.findUnique({
      where: { username: parsed.data.username },
      select: {
        id: true,
        isActive: true,
        username: true,
        recoveryEmail: true,
      },
    });
  } catch (error) {
    if (!isMissingColumnError(error, "recoveryEmail")) {
      throw error;
    }
  }

  const canSend =
    Boolean(user?.isActive) &&
    Boolean(user?.recoveryEmail);
  if (canSend && user?.recoveryEmail) {
    const rawToken = randomBytes(24).toString("hex");
    const tokenHash = hashResetToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    try {
      await prisma.$transaction([
        prisma.passwordResetToken.deleteMany({
          where: {
            userId: user.id,
            OR: [{ usedAt: null }, { expiresAt: { lt: new Date() } }],
          },
        }),
        prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash,
            expiresAt,
            requestedByIp: req.ip ?? null,
          },
        }),
      ]);
    } catch (error) {
      if (isMissingTableError(error, "PasswordResetToken")) {
        res.status(503).json({ message: "Password reset is temporarily unavailable" });
        return;
      }
      throw error;
    }

    await sendPasswordResetEmail(user.recoveryEmail, user.username, rawToken);
  }

  await wait(500);
  res.json({ ok: true, message: "If the account is eligible, a reset email has been sent." });
});

authRouter.post("/reset-password", async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid payload" });
    return;
  }

  const tokenHash = hashResetToken(parsed.data.token);
  const now = new Date();
  let token:
    | { id: string; userId: string }
    | null = null;
  try {
    token = await prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: now },
        user: { isActive: true },
      },
      select: {
        id: true,
        userId: true,
      },
    });
  } catch (error) {
    if (isMissingTableError(error, "PasswordResetToken")) {
      res.status(503).json({ message: "Password reset is temporarily unavailable" });
      return;
    }
    throw error;
  }
  if (!token) {
    res.status(400).json({ message: "Invalid or expired reset token" });
    return;
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: token.userId },
        data: { passwordHash, forcePasswordChange: false },
      }),
      prisma.passwordResetToken.update({
        where: { id: token.id },
        data: { usedAt: now },
      }),
      prisma.passwordResetToken.deleteMany({
        where: {
          userId: token.userId,
          id: { not: token.id },
        },
      }),
    ]);
  } catch (error) {
    if (!isMissingColumnError(error, "forcePasswordChange")) {
      throw error;
    }
    await prisma.$transaction([
      prisma.user.update({
        where: { id: token.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: token.id },
        data: { usedAt: now },
      }),
      prisma.passwordResetToken.deleteMany({
        where: {
          userId: token.userId,
          id: { not: token.id },
        },
      }),
    ]);
  }

  res.json({ ok: true, message: "Password reset successful" });
});
