import { Router } from "express";
import bcrypt from "bcryptjs";
import prismaClientPackage, { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { hasPermission } from "../services/rbac.js";
import type { AuthenticatedRequest } from "../types.js";

const { RoleKey } = prismaClientPackage;

export const usersRouter = Router();
const createUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  recoveryEmail: z.string().email().max(200).nullable().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.nativeEnum(RoleKey).default("REPAIRER"),
});
const setStatusSchema = z.object({
  isActive: z.boolean(),
});
const resetPasswordSchema = z.object({
  newPassword: z.string().min(8),
});
const setRolesSchema = z.object({
  roles: z.array(z.nativeEnum(RoleKey)).min(1),
});

function isMissingForcePasswordChangeColumn(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2022" &&
    typeof error.message === "string" &&
    error.message.includes("forcePasswordChange")
  );
}

usersRouter.get("/", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!req.user || !hasPermission(req.user.roles, "repairs:assign")) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, username: true, fullName: true },
    orderBy: { fullName: "asc" },
  });

  res.json({ users });
});

usersRouter.post("/", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!req.user || !hasPermission(req.user.roles, "users:manage")) {
    res.status(403).json({ message: "Only authorized users can create users" });
    return;
  }

  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    res.status(400).json({ message: `Validation failed: ${issues.join("; ")}` });
    return;
  }

  const existing = await prisma.user.findUnique({
    where: { username: parsed.data.username },
    select: { id: true },
  });
  if (existing) {
    res.status(409).json({ message: "Username already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const createData: {
    username: string;
    fullName: string;
    passwordHash: string;
    recoveryEmail?: string | null;
  } = {
    username: parsed.data.username,
    fullName: parsed.data.fullName,
    passwordHash,
  };
  if (parsed.data.recoveryEmail !== undefined) {
    createData.recoveryEmail = parsed.data.recoveryEmail;
  }

  const user = await prisma.user.create({ data: createData });

  const role = await prisma.role.upsert({
    where: { key: parsed.data.role },
    update: {},
    create: { key: parsed.data.role },
  });

  await prisma.userRole.create({
    data: {
      userId: user.id,
      roleId: role.id,
    },
  });

  res.status(201).json({
    user: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: parsed.data.role,
    },
  });
});

usersRouter.get("/repairers", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!req.user || !hasPermission(req.user.roles, "users:manage")) {
    res.status(403).json({ message: "Only authorized users can view user management" });
    return;
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      fullName: true,
      recoveryEmail: true,
      isActive: true,
      roles: { select: { role: { select: { key: true } } } },
    },
    orderBy: { fullName: "asc" },
  });

  res.json({
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      fullName: u.fullName,
      recoveryEmail: u.recoveryEmail,
      isActive: u.isActive,
      roles: u.roles.map((r) => r.role.key),
    })),
  });
});

usersRouter.patch("/:id/status", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!req.user || !hasPermission(req.user.roles, "users:manage")) {
    res.status(403).json({ message: "Only authorized users can update user status" });
    return;
  }

  const parsed = setStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid payload" });
    return;
  }

  const userId = String(req.params.id);
  if (req.user.id === userId && !parsed.data.isActive) {
    res.status(400).json({ message: "You cannot deactivate your own account" });
    return;
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { isActive: parsed.data.isActive },
    select: { id: true, username: true, fullName: true, isActive: true },
  });

  res.json({ user });
});

usersRouter.post("/:id/reset-password", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!req.user || !hasPermission(req.user.roles, "users:manage")) {
    res.status(403).json({ message: "Only authorized users can reset passwords" });
    return;
  }

  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid payload" });
    return;
  }

  const userId = String(req.params.id);
  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  let user: { id: string; username: string; fullName: string };
  try {
    user = await prisma.user.update({
      where: { id: userId },
      data: { passwordHash, forcePasswordChange: true },
      select: { id: true, username: true, fullName: true },
    });
  } catch (error) {
    if (!isMissingForcePasswordChangeColumn(error)) {
      throw error;
    }
    user = await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
      select: { id: true, username: true, fullName: true },
    });
  }

  res.json({ user, message: "Password reset successful" });
});

usersRouter.patch("/:id/roles", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!req.user || !hasPermission(req.user.roles, "users:manage")) {
    res.status(403).json({ message: "Only authorized users can update roles" });
    return;
  }

  const parsed = setRolesSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid payload" });
    return;
  }

  const userId = String(req.params.id);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      fullName: true,
      isActive: true,
      roles: { select: { role: { select: { key: true } } } },
    },
  });
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  if (req.user.id === userId && !parsed.data.roles.includes("ADMIN")) {
    res.status(400).json({ message: "You cannot remove your own ADMIN role" });
    return;
  }

  const desiredRoleKeys = [...new Set(parsed.data.roles)];
  const desiredRoles = await Promise.all(
    desiredRoleKeys.map((key) =>
      prisma.role.upsert({
        where: { key },
        update: {},
        create: { key },
      }),
    ),
  );
  const desiredRoleIds = new Set(desiredRoles.map((role) => role.id));

  await prisma.$transaction([
    prisma.userRole.deleteMany({
      where: {
        userId,
        roleId: { notIn: Array.from(desiredRoleIds) },
      },
    }),
    ...desiredRoles.map((role) =>
      prisma.userRole.upsert({
        where: {
          userId_roleId: {
            userId,
            roleId: role.id,
          },
        },
        update: {},
        create: {
          userId,
          roleId: role.id,
        },
      }),
    ),
  ]);

  const updated = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      fullName: true,
      isActive: true,
      roles: { select: { role: { select: { key: true } } } },
    },
  });

  res.json({
    user: updated && {
      id: updated.id,
      username: updated.username,
      fullName: updated.fullName,
      isActive: updated.isActive,
      roles: updated.roles.map((r) => r.role.key),
    },
  });
});

usersRouter.delete("/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!req.user || !hasPermission(req.user.roles, "users:manage")) {
    res.status(403).json({ message: "Only authorized users can delete users" });
    return;
  }

  const userId = String(req.params.id);
  if (req.user.id === userId) {
    res.status(400).json({ message: "You cannot delete your own account" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  const assignedRepairs = await prisma.repair.count({
    where: { assignedToUserId: userId, status: { notIn: ["COMPLETED", "CANCELLED"] } },
  });
  if (assignedRepairs > 0) {
    res.status(400).json({
      message: `Cannot delete: user has ${assignedRepairs} active repair(s) assigned. Reassign or complete them first.`,
    });
    return;
  }

  await prisma.$transaction([
    prisma.userRole.deleteMany({ where: { userId } }),
    prisma.repair.updateMany({ where: { assignedToUserId: userId }, data: { assignedToUserId: null } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);

  res.json({ ok: true });
});
