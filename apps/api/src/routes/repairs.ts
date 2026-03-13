import fs from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import prismaClientPackage from "@prisma/client";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types.js";
import { hasPermission, isAdmin } from "../services/rbac.js";
import { generatePublicRef } from "../services/publicRef.js";
import { resolvePhotoPath, storePhoto } from "../services/storage.js";
import { buildLabelPayload, printPayload } from "../services/label.js";

const { RepairStatus, Prisma } = prismaClientPackage;
type RepairCreateData = prismaClientPackage.Prisma.RepairUncheckedCreateInput;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
});

const createRepairSchema = z.object({
  productType: z.string().optional(),
  createdDate: z.string().datetime().optional(),
  assignedToUserId: z.string().uuid().nullable().optional(),
  itemName: z.string().optional(),
  problemDescription: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

const updateRepairSchema = z.object({
  repairNumber: z.number().int().nullable().optional(),
  productType: z.string().nullable().optional(),
  createdDate: z.string().datetime().nullable().optional(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  itemName: z.string().nullable().optional(),
  problemDescription: z.string().nullable().optional(),
  status: z.nativeEnum(RepairStatus).optional(),
  outcome: z.enum(["YES", "PARTIAL", "NO"]).nullable().optional(),
  assignedToUserId: z.string().uuid().nullable().optional(),
  successful: z.boolean().nullable().optional(),
  safetyTested: z.boolean().nullable().optional(),
  fixDescription: z.string().nullable().optional(),
  material: z.string().nullable().optional(),
  technicianNotes: z.string().nullable().optional(),
  completedAt: z.string().datetime().nullable().optional(),
});

const workUpdateSchema = z.object({
  status: z.nativeEnum(RepairStatus).optional(),
  notified: z.boolean().nullable().optional(),
  outcome: z.enum(["YES", "PARTIAL", "NO"]).nullable().optional(),
  successful: z.boolean().nullable().optional(),
  fixDescription: z.string().nullable().optional(),
  material: z.string().nullable().optional(),
  safetyTested: z.boolean().nullable().optional(),
  technicianNotes: z.string().nullable().optional(),
});

const printSchema = z.object({
  printerProfileId: z.string().uuid().nullable().optional(),
  dryRun: z.boolean().optional(),
});

const translationQuerySchema = z.object({
  targetLang: z.enum(["de", "en"]).default("en"),
});

function isMissingPrintAgentTableError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021" &&
    typeof error.message === "string" &&
    error.message.includes("PrintAgent")
  );
}

function translateGermanToEnglish(text: string | null | undefined): string {
  if (!text) return "";
  const dictionary: Array<[RegExp, string]> = [
    [/\bReparatur\b/gi, "repair"],
    [/\bdefekt\b/gi, "defective"],
    [/\bkaputt\b/gi, "broken"],
    [/\bKabelhülle\b/gi, "cable jacket"],
    [/\bBatterie\b/gi, "battery"],
    [/\bLadegerät\b/gi, "charger"],
    [/\bStecker\b/gi, "plug"],
    [/\bSchalter\b/gi, "switch"],
    [/\bnicht\b/gi, "not"],
    [/\bgeht\b/gi, "works"],
    [/\bfunktioniert\b/gi, "works"],
  ];

  let result = text;
  for (const [pattern, replacement] of dictionary) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function canViewRepair(req: AuthenticatedRequest, assignedToUserId: string | null): boolean {
  if (!req.user) return false;
  if (hasPermission(req.user.roles, "repairs:view_all")) return true;
  return assignedToUserId === req.user.id;
}

const POS_FIELD_KEYS = new Set([
  "productType",
  "createdDate",
  "firstName",
  "lastName",
  "city",
  "email",
  "phone",
  "itemName",
  "problemDescription",
  "assignedToUserId",
]);

const REPAIRER_FIELD_KEYS = new Set([
  "successful",
  "outcome",
  "status",
  "fixDescription",
  "material",
  "safetyTested",
  "technicianNotes",
  "assignedToUserId",
]);

const REPAIR_NUMBER_LOCK_KEY = 31042026;

export const repairsRouter = Router();

repairsRouter.use(requireAuth);

repairsRouter.get("/", async (req: AuthenticatedRequest, res) => {
  const scope = String(req.query.scope ?? "my");
  const query = String(req.query.q ?? "");
  const archived = String(req.query.archived ?? "false").toLowerCase() === "true";
  const page = Math.max(1, Number(req.query.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 25)));
  const sortBy = String(req.query.sortBy ?? "updatedAt");
  const sortDir = String(req.query.sortDir ?? "desc").toLowerCase() === "asc" ? "asc" : "desc";
  const user = req.user!;
  const canViewAll = hasPermission(user.roles, "repairs:view_all");
  const adminUser = isAdmin(user.roles);

  const where: any = {};
  if (archived) {
    if (!adminUser) {
      res.status(403).json({ message: "Only admins can view archived repairs" });
      return;
    }
    where.status = { in: [RepairStatus.COMPLETED, RepairStatus.CANCELLED] };
  } else {
    where.status = { notIn: [RepairStatus.COMPLETED, RepairStatus.CANCELLED] };
  }
  if (scope !== "all" || !canViewAll) {
    where.assignedToUserId = user.id;
  }
  if (query) {
    where.OR = [
      { publicRef: { contains: query, mode: "insensitive" } },
      { itemName: { contains: query, mode: "insensitive" } },
      { problemDescription: { contains: query, mode: "insensitive" } },
      { firstName: { contains: query, mode: "insensitive" } },
      { lastName: { contains: query, mode: "insensitive" } },
    ];
  }

  const orderByFieldMap: Record<string, "updatedAt" | "createdDate" | "repairNumber" | "itemName" | "status" | "publicRef"> = {
    updatedAt: "updatedAt",
    createdDate: "createdDate",
    repairNumber: "repairNumber",
    itemName: "itemName",
    status: "status",
    publicRef: "publicRef",
  };
  const orderByField = orderByFieldMap[sortBy] ?? "updatedAt";

  const [total, repairs] = await Promise.all([
    prisma.repair.count({ where }),
    prisma.repair.findMany({
      where,
      include: {
        assignedToUser: { select: { id: true, fullName: true, username: true } },
        photos: true,
      },
      orderBy: { [orderByField]: sortDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  res.json({
    repairs,
    scope: scope === "all" && canViewAll ? "all" : "my",
    archived,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
    sort: {
      sortBy: orderByField,
      sortDir,
    },
  });
});

repairsRouter.post("/", async (req: AuthenticatedRequest, res) => {
  if (!hasPermission(req.user!.roles, "repairs:create")) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  const parsed = createRepairSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid payload" });
    return;
  }

  const user = req.user!;
  const fullAccess = isAdmin(user.roles) || user.roles.includes("SUPERVISOR");
  const canEditPosFields = hasPermission(user.roles, "repairs:edit_pos_fields");
  const canAssign = hasPermission(user.roles, "repairs:assign");

  if (!fullAccess && !canEditPosFields) {
    res.status(403).json({ message: "Role cannot create repairs" });
    return;
  }
  if (parsed.data.assignedToUserId !== undefined && !canAssign) {
    res.status(403).json({ message: "Missing assignment permission" });
    return;
  }

  const requestedEntries = Object.entries(parsed.data).filter(([, value]) => value !== undefined);
  const disallowedKeys = fullAccess
    ? []
    : requestedEntries
      .map(([key]) => key)
      .filter((key) => !POS_FIELD_KEYS.has(key));
  if (disallowedKeys.length > 0) {
    res.status(403).json({ message: `Role cannot set fields: ${disallowedKeys.join(", ")}` });
    return;
  }

  const createData: RepairCreateData = {
    publicRef: generatePublicRef(),
    assignedToUserId:
      parsed.data.assignedToUserId !== undefined
        ? parsed.data.assignedToUserId
        : null,
    status:
      (parsed.data.assignedToUserId ?? null)
        ? RepairStatus.IN_PROGRESS
        : RepairStatus.NEW,
    createdDate: parsed.data.createdDate ? new Date(parsed.data.createdDate) : new Date(),
    updatedByUserId: user.id,
  };
  for (const [key, value] of requestedEntries) {
    if (key === "createdDate" || key === "assignedToUserId") continue;
    (createData as Record<string, unknown>)[key] = value;
  }

  const repair = await prisma.$transaction(async (tx) => {
    // Serialize "next repair number" allocation across concurrent creators.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${REPAIR_NUMBER_LOCK_KEY})`;
    const maxRepairNumber = await tx.repair.aggregate({ _max: { repairNumber: true } });
    const nextRepairNumber = (maxRepairNumber._max.repairNumber ?? 0) + 1;

    const createdRepair = await tx.repair.create({
      data: {
        ...createData,
        repairNumber: nextRepairNumber,
      },
    });

    await tx.repairAssignmentHistory.create({
      data: {
        repairId: createdRepair.id,
        toUserId: (createData.assignedToUserId as string | null) ?? null,
        changedById: user.id,
        notes: (createData.assignedToUserId as string | null) ? "Assigned during create" : "Unassigned during create",
      },
    });

    return createdRepair;
  });

  res.status(201).json({ repair });
});

repairsRouter.get("/:id", async (req: AuthenticatedRequest, res) => {
  const repairId = String(req.params.id);
  const repair = await prisma.repair.findUnique({
    where: { id: repairId },
    include: {
      assignedToUser: { select: { id: true, fullName: true, username: true } },
      photos: true,
      statusHistory: { orderBy: { createdAt: "desc" }, take: 20 },
      assignmentHistory: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });

  if (!repair) {
    res.status(404).json({ message: "Repair not found" });
    return;
  }

  if (!canViewRepair(req, repair.assignedToUserId)) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  res.json({ repair });
});

repairsRouter.get("/by-ref/:publicRef", async (req: AuthenticatedRequest, res) => {
  const publicRef = String(req.params.publicRef);
  const repair = await prisma.repair.findUnique({
    where: { publicRef },
    include: {
      assignedToUser: { select: { id: true, fullName: true, username: true } },
      photos: true,
      statusHistory: { orderBy: { createdAt: "desc" }, take: 20 },
      assignmentHistory: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });

  if (!repair) {
    res.status(404).json({ message: "Repair not found" });
    return;
  }

  if (!canViewRepair(req, repair.assignedToUserId)) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  res.json({ repair });
});

repairsRouter.get("/:id/translation", async (req: AuthenticatedRequest, res) => {
  const repairId = String(req.params.id);
  const parsed = translationQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid translation query" });
    return;
  }

  const repair = await prisma.repair.findUnique({
    where: { id: repairId },
    select: {
      id: true,
      assignedToUserId: true,
      itemName: true,
      problemDescription: true,
      fixDescription: true,
      technicianNotes: true,
    },
  });

  if (!repair) {
    res.status(404).json({ message: "Repair not found" });
    return;
  }
  if (!canViewRepair(req, repair.assignedToUserId)) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  const targetLang = parsed.data.targetLang;
  if (targetLang === "de") {
    res.json({
      targetLang,
      translation: {
        itemName: repair.itemName ?? "",
        problemDescription: repair.problemDescription ?? "",
        fixDescription: repair.fixDescription ?? "",
        technicianNotes: repair.technicianNotes ?? "",
      },
      source: "original",
    });
    return;
  }

  res.json({
    targetLang,
    translation: {
      itemName: translateGermanToEnglish(repair.itemName),
      problemDescription: translateGermanToEnglish(repair.problemDescription),
      fixDescription: translateGermanToEnglish(repair.fixDescription),
      technicianNotes: translateGermanToEnglish(repair.technicianNotes),
    },
    source: "inline-dictionary",
  });
});

repairsRouter.patch("/:id", async (req: AuthenticatedRequest, res) => {
  const repairId = String(req.params.id);
  const parsed = updateRepairSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid payload" });
    return;
  }

  const existing = await prisma.repair.findUnique({ where: { id: repairId } });
  if (!existing) {
    res.status(404).json({ message: "Repair not found" });
    return;
  }

  const user = req.user!;
  const fullAccess = isAdmin(user.roles) || user.roles.includes("SUPERVISOR");
  const canEditPosFields = hasPermission(user.roles, "repairs:edit_pos_fields");
  const canEditRepairFields = hasPermission(user.roles, "repairs:edit_repair_fields");
  const canAssign = hasPermission(user.roles, "repairs:assign");
  const requestedEntries = Object.entries(parsed.data).filter(([, value]) => value !== undefined);
  const requestedKeys = requestedEntries.map(([key]) => key);
  if (requestedKeys.length === 0) {
    res.status(400).json({ message: "No fields provided" });
    return;
  }

  const allowedKeys = new Set<string>();
  if (fullAccess) {
    for (const key of Object.keys(parsed.data)) allowedKeys.add(key);
  } else {
    if (canEditPosFields) POS_FIELD_KEYS.forEach((key) => allowedKeys.add(key));
    if (canEditRepairFields) REPAIRER_FIELD_KEYS.forEach((key) => allowedKeys.add(key));
  }
  const disallowedKeys = requestedKeys.filter((key) => !allowedKeys.has(key));
  if (disallowedKeys.length > 0) {
    res.status(403).json({ message: `Role cannot edit fields: ${disallowedKeys.join(", ")}` });
    return;
  }

  const isAssignChange = parsed.data.assignedToUserId !== undefined;
  if (isAssignChange && !canAssign) {
    res.status(403).json({ message: "Missing assignment permission" });
    return;
  }

  if (!canViewRepair(req, existing.assignedToUserId)) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  const updateData: Record<string, unknown> = {
    updatedByUserId: user.id,
  };
  for (const [key, value] of requestedEntries) {
    if (key === "completedAt") {
      updateData.completedAt = value ? new Date(String(value)) : null;
      continue;
    }
    if (key === "createdDate") {
      updateData.createdDate = value ? new Date(String(value)) : null;
      continue;
    }
    updateData[key] = value;
  }

  const shouldAutoMoveToInProgress =
    isAssignChange &&
    Boolean(parsed.data.assignedToUserId) &&
    parsed.data.status === undefined &&
    existing.status === RepairStatus.NEW;
  if (shouldAutoMoveToInProgress) {
    updateData.status = RepairStatus.IN_PROGRESS;
  }

  const updated = await prisma.repair.update({
    where: { id: repairId },
    data: updateData,
  });

  const nextStatus =
    parsed.data.status ?? (shouldAutoMoveToInProgress ? RepairStatus.IN_PROGRESS : null);
  if (nextStatus && nextStatus !== existing.status) {
    await prisma.repairStatusHistory.create({
      data: {
        repairId: existing.id,
        fromStatus: existing.status,
        toStatus: nextStatus,
        changedById: user.id,
      },
    });
  }

  if (isAssignChange && parsed.data.assignedToUserId !== existing.assignedToUserId) {
    await prisma.repairAssignmentHistory.create({
      data: {
        repairId: existing.id,
        fromUserId: existing.assignedToUserId,
        toUserId: parsed.data.assignedToUserId ?? null,
        changedById: user.id,
      },
    });
  }

  res.json({ repair: updated });
});

repairsRouter.patch("/:id/work", async (req: AuthenticatedRequest, res) => {
  const repairId = String(req.params.id);
  const parsed = workUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid payload" });
    return;
  }

  const repair = await prisma.repair.findUnique({ where: { id: repairId } });
  if (!repair) {
    res.status(404).json({ message: "Repair not found" });
    return;
  }

  const user = req.user!;
  if (!hasPermission(user.roles, "repairs:edit_repair_fields")) {
    res.status(403).json({ message: "Role cannot edit repair work fields" });
    return;
  }
  const canEdit =
    repair.assignedToUserId === user.id || isAdmin(user.roles) || user.roles.includes("SUPERVISOR");
  if (!canEdit) {
    res.status(403).json({ message: "Only assigned repairer can edit repair work fields" });
    return;
  }

  const updated = await prisma.repair.update({
    where: { id: repairId },
    data: {
      ...parsed.data,
      updatedByUserId: user.id,
    },
  });

  if (parsed.data.status && parsed.data.status !== repair.status) {
    await prisma.repairStatusHistory.create({
      data: {
        repairId: repair.id,
        fromStatus: repair.status,
        toStatus: parsed.data.status,
        changedById: user.id,
      },
    });
  }

  res.json({ repair: updated });
});

repairsRouter.post("/:id/photos", upload.array("photos", 5), async (req: AuthenticatedRequest, res) => {
  const repairId = String(req.params.id);
  const repair = await prisma.repair.findUnique({ where: { id: repairId } });
  if (!repair) {
    res.status(404).json({ message: "Repair not found" });
    return;
  }
  if (!canViewRepair(req, repair.assignedToUserId)) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  const files = (req.files as Express.Multer.File[]) ?? [];
  if (!files.length) {
    res.status(400).json({ message: "No files uploaded" });
    return;
  }

  const created = [];
  for (const file of files) {
    const extension = path.extname(file.originalname).replace(".", "") || "bin";
    const stored = await storePhoto(file.buffer, extension);
    const photo = await prisma.repairPhoto.create({
      data: {
        repairId: repair.id,
        storageKey: stored.storageKey,
        originalFileName: file.originalname,
        mimeType: file.mimetype,
        checksum: stored.checksum,
        createdByUserId: req.user?.id,
      },
    });
    created.push(photo);
  }

  res.status(201).json({ photos: created });
});

repairsRouter.get("/:id/photos/:photoId", async (req: AuthenticatedRequest, res) => {
  const repairId = String(req.params.id);
  const photoId = String(req.params.photoId);
  const photo = await prisma.repairPhoto.findFirst({
    where: { id: photoId, repairId },
  });
  if (!photo) {
    res.status(404).json({ message: "Photo not found" });
    return;
  }
  const linkedRepair = await prisma.repair.findUnique({ where: { id: photo.repairId } });
  if (!linkedRepair) {
    res.status(404).json({ message: "Repair not found" });
    return;
  }

  if (!canViewRepair(req, linkedRepair.assignedToUserId)) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  const fullPath = resolvePhotoPath(photo.storageKey);
  try {
    await fs.access(fullPath);
    res.setHeader("content-type", photo.mimeType);
    res.sendFile(fullPath);
  } catch {
    res.status(404).json({ message: "Photo file missing in storage" });
  }
});

repairsRouter.delete("/:id/photos/:photoId", async (req: AuthenticatedRequest, res) => {
  const repairId = String(req.params.id);
  const photoId = String(req.params.photoId);

  const photo = await prisma.repairPhoto.findFirst({
    where: { id: photoId, repairId },
  });
  if (!photo) {
    res.status(404).json({ message: "Photo not found" });
    return;
  }

  const linkedRepair = await prisma.repair.findUnique({ where: { id: repairId } });
  if (!linkedRepair) {
    res.status(404).json({ message: "Repair not found" });
    return;
  }
  if (!canViewRepair(req, linkedRepair.assignedToUserId)) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  await prisma.repairPhoto.delete({ where: { id: photo.id } });

  const fullPath = resolvePhotoPath(photo.storageKey);
  try {
    await fs.unlink(fullPath);
  } catch {
    // File may already be missing; DB record is already removed.
  }

  res.json({ ok: true });
});

repairsRouter.delete("/:id", async (req: AuthenticatedRequest, res) => {
  if (!isAdmin(req.user!.roles)) {
    res.status(403).json({ message: "Only admins can delete repairs" });
    return;
  }

  const repairId = String(req.params.id);
  const repair = await prisma.repair.findUnique({
    where: { id: repairId },
    include: {
      photos: { select: { storageKey: true } },
    },
  });
  if (!repair) {
    res.status(404).json({ message: "Repair not found" });
    return;
  }

  await prisma.repair.delete({ where: { id: repair.id } });

  for (const photo of repair.photos) {
    const fullPath = resolvePhotoPath(photo.storageKey);
    try {
      await fs.unlink(fullPath);
    } catch {
      // File may already be missing.
    }
  }

  res.json({ ok: true });
});

repairsRouter.post("/:id/print-label", async (req: AuthenticatedRequest, res) => {
  const repairId = String(req.params.id);
  if (!hasPermission(req.user!.roles, "repairs:print")) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  const parsed = printSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid payload" });
    return;
  }

  const repair = await prisma.repair.findUnique({
    where: { id: repairId },
  });
  if (!repair) {
    res.status(404).json({ message: "Repair not found" });
    return;
  }
  if (!canViewRepair(req, repair.assignedToUserId)) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  const assignedToUser = repair.assignedToUserId
    ? await prisma.user.findUnique({ where: { id: repair.assignedToUserId } })
    : null;

  const printer = parsed.data.printerProfileId
    ? await prisma.printerProfile.findUnique({ where: { id: parsed.data.printerProfileId } })
    : null;
  const payload = buildLabelPayload(
    { ...repair, assignedToName: assignedToUser?.fullName ?? null },
    {
      charsPerLine: printer?.charsPerLine ?? 40,
      cutAfterPrint: printer?.cutAfterPrint ?? true,
      feedLines: printer?.feedLines ?? 4,
    },
  );

  let success = true;
  let spoolPath: string | undefined;
  let errorMessage: string | undefined;
  let queued = false;
  if (!parsed.data.dryRun) {
    try {
      if (printer) {
        try {
          const activeAgent = await prisma.printAgent.findFirst({
            where: {
              printerProfileId: printer.id,
              isActive: true,
            },
            orderBy: { lastSeenAt: "desc" },
          });
          if (activeAgent) {
            await prisma.printJob.create({
              data: {
                repairId: repair.id,
                printerProfileId: printer.id,
                payload: new Uint8Array(payload),
                status: "PENDING",
              },
            });
            queued = true;
          } else {
            const result = await printPayload(payload, printer);
            spoolPath = result.spoolPath;
          }
        } catch (error) {
          if (!isMissingPrintAgentTableError(error)) {
            throw error;
          }
          // Backward-compatible fallback while cluster migration is being rolled out.
          const result = await printPayload(payload, printer);
          spoolPath = result.spoolPath;
        }
      } else {
        const result = await printPayload(payload, printer);
        spoolPath = result.spoolPath;
      }
    } catch (error) {
      success = false;
      errorMessage = error instanceof Error ? error.message : "Unknown print error";
    }
  }

  await prisma.printLog.create({
    data: {
      repairId: repair.id,
      printerProfileId: printer?.id ?? null,
      printedById: req.user!.id,
      payloadBytes: payload.byteLength,
      success,
      errorMessage: errorMessage ?? null,
    },
  });

  if (!success) {
    res.status(500).json({ message: errorMessage });
    return;
  }

  res.json({
    ok: true,
    bytes: payload.byteLength,
    spoolPath: spoolPath ?? null,
    queued,
    dryRun: Boolean(parsed.data.dryRun),
  });
});
