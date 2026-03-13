import { Router } from "express";
import bcrypt from "bcryptjs";
import prismaClientPackage from "@prisma/client";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { hasPermission } from "../services/rbac.js";
import type { AuthenticatedRequest } from "../types.js";

const { RoleKey } = prismaClientPackage;

export const usersRouter = Router();
const createUserSchema = z.object({
  username: z.string().min(3),
  fullName: z.string().min(2),
  password: z.string().min(8),
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
    res.status(400).json({ message: "Invalid payload" });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { username: parsed.data.username } });
  if (existing) {
    res.status(409).json({ message: "Username already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const user = await prisma.user.create({
    data: {
      username: parsed.data.username,
      fullName: parsed.data.fullName,
      passwordHash,
    },
  });

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
    include: { roles: { include: { role: true } } },
    orderBy: { fullName: "asc" },
  });

  res.json({
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      fullName: u.fullName,
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
  const user = await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
    select: { id: true, username: true, fullName: true },
  });

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
    include: { roles: { include: { role: true } } },
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
    include: { roles: { include: { role: true } } },
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
