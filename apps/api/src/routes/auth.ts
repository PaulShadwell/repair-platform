import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { z } from "zod";
import { config } from "../config.js";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types.js";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid payload" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { username: parsed.data.username },
    include: { roles: { include: { role: true } } },
  });

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
    },
  });
});

authRouter.get("/me", requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: { roles: { include: { role: true } } },
  });
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
    },
  });
});
