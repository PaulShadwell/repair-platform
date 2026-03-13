import fs from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types.js";
import { resolvePhotoPath, storePhoto } from "../services/storage.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

const updateProfileSchema = z.object({
  fullName: z.string().min(2).max(120).optional(),
  profilePhone: z.string().max(60).nullable().optional(),
  profileLocation: z.string().max(120).nullable().optional(),
  aboutMe: z.string().max(1000).nullable().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

function getExtensionFromMimeType(mimeType: string): string {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "bin";
  }
}

export const profileRouter = Router();

profileRouter.use(requireAuth);

profileRouter.get("/", async (req: AuthenticatedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true,
      username: true,
      fullName: true,
      profilePhone: true,
      profileLocation: true,
      aboutMe: true,
      profileImageKey: true,
      updatedAt: true,
    },
  });
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  res.json({
    profile: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      profilePhone: user.profilePhone,
      profileLocation: user.profileLocation,
      aboutMe: user.aboutMe,
      hasAvatar: Boolean(user.profileImageKey),
      updatedAt: user.updatedAt.toISOString(),
    },
  });
});

profileRouter.patch("/", async (req: AuthenticatedRequest, res) => {
  const parsed = updateProfileSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid payload" });
    return;
  }

  const updated = await prisma.user.update({
    where: { id: req.user!.id },
    data: parsed.data,
    select: {
      id: true,
      username: true,
      fullName: true,
      profilePhone: true,
      profileLocation: true,
      aboutMe: true,
      profileImageKey: true,
      updatedAt: true,
    },
  });

  res.json({
    profile: {
      id: updated.id,
      username: updated.username,
      fullName: updated.fullName,
      profilePhone: updated.profilePhone,
      profileLocation: updated.profileLocation,
      aboutMe: updated.aboutMe,
      hasAvatar: Boolean(updated.profileImageKey),
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
});

profileRouter.post("/avatar", upload.single("avatar"), async (req: AuthenticatedRequest, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ message: "No avatar file uploaded" });
    return;
  }
  if (!file.mimetype.startsWith("image/")) {
    res.status(400).json({ message: "Avatar must be an image" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { profileImageKey: true },
  });
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  const extension = getExtensionFromMimeType(file.mimetype);
  const stored = await storePhoto(file.buffer, extension);
  const storageKey = path.posix.join("avatars", stored.storageKey);
  const avatarPath = resolvePhotoPath(storageKey);
  await fs.mkdir(path.dirname(avatarPath), { recursive: true });
  await fs.rename(stored.absolutePath, avatarPath);

  if (user.profileImageKey) {
    try {
      await fs.unlink(resolvePhotoPath(user.profileImageKey));
    } catch {
      // Ignore missing old file.
    }
  }

  await prisma.user.update({
    where: { id: req.user!.id },
    data: { profileImageKey: storageKey },
  });

  res.json({ ok: true });
});

profileRouter.get("/avatar", async (req: AuthenticatedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { profileImageKey: true },
  });
  if (!user || !user.profileImageKey) {
    res.status(404).json({ message: "Avatar not found" });
    return;
  }

  const avatarPath = resolvePhotoPath(user.profileImageKey);
  try {
    await fs.access(avatarPath);
    res.sendFile(avatarPath);
  } catch {
    res.status(404).json({ message: "Avatar file missing in storage" });
  }
});

profileRouter.post("/change-password", async (req: AuthenticatedRequest, res) => {
  const parsed = changePasswordSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid payload" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { passwordHash: true },
  });
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) {
    res.status(400).json({ message: "Current password is incorrect" });
    return;
  }

  const nextHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.user.update({
    where: { id: req.user!.id },
    data: { passwordHash: nextHash },
  });

  res.json({ ok: true });
});
