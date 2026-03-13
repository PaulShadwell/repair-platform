import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient, RepairStatus } from "@prisma/client";
import { generatePublicRef } from "./services/publicRef.js";

const prisma = new PrismaClient();

function mapStatus(raw: unknown): RepairStatus {
  const value = String(raw ?? "").toLowerCase();
  if (value.includes("angenommen") || value.includes("new")) return RepairStatus.NEW;
  if (value.includes("in reparatur") || value.includes("arbeit") || value.includes("progress")) return RepairStatus.IN_PROGRESS;
  if (value.includes("ersatzteil") || value.includes("bestellt") || value.includes("parts")) return RepairStatus.WAITING_PARTS;
  if (value.includes("abholbereit") || value.includes("avisiert") || value.includes("ready")) return RepairStatus.READY_FOR_PICKUP;
  if (value.includes("abgeholt") || value.includes("completed") || value.includes("done")) return RepairStatus.COMPLETED;
  if (value.includes("entsorgt") || value.includes("disposed") || value.includes("cancel")) return RepairStatus.CANCELLED;
  return RepairStatus.NEW;
}

function mapSuccess(raw: unknown): boolean | null {
  const value = Number(raw);
  if (value === 1) return true; // Ja
  if (value === 3) return false; // Nein
  return null; // Teilweise/unknown
}

function mapOutcome(raw: unknown): "YES" | "PARTIAL" | "NO" | null {
  const value = Number(raw);
  if (value === 1) return "YES";
  if (value === 2) return "PARTIAL";
  if (value === 3) return "NO";
  return null;
}

async function main(): Promise<void> {
  const sqlitePathArg = process.argv[2];
  if (!sqlitePathArg) {
    throw new Error("Usage: npm run migrate:sqlite -- <path-to-repairkafi.sqlite>");
  }

  const cwdPath = path.resolve(process.cwd(), sqlitePathArg);
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const projectRootPath = path.resolve(scriptDir, "..", "..", "..", sqlitePathArg);
  const sqlitePath = fs.existsSync(cwdPath)
    ? cwdPath
    : fs.existsSync(projectRootPath)
      ? projectRootPath
      : null;

  if (!sqlitePath) {
    throw new Error(
      `SQLite file not found. Checked:\n- ${cwdPath}\n- ${projectRootPath}\nTip: from repair-platform root use ../../../db/repairkafi.sqlite or absolute path.`,
    );
  }

  const db = new Database(sqlitePath, { readonly: true });

  const dates = db.prepare("SELECT id, datum FROM dates").all() as Array<{ id: number; datum: string }>;
  const dateMap = new Map<number, Date>();
  for (const row of dates) {
    const d = new Date(row.datum);
    if (!Number.isNaN(d.valueOf())) dateMap.set(row.id, d);
  }

  const repairerRows = db.prepare("SELECT id, name FROM reparateur").all() as Array<{ id: number; name: string }>;
  const repairerMap = new Map<number, string>();
  const repairerRole = await prisma.role.upsert({
    where: { key: "REPAIRER" },
    update: {},
    create: { key: "REPAIRER" },
  });
  for (const row of repairerRows) {
    repairerMap.set(row.id, row.name);
    const username = String(row.name).trim().toLowerCase().replace(/\s+/g, ".");
    const user = await prisma.user.upsert({
      where: { username },
      update: {},
      create: {
        username,
        fullName: row.name,
        passwordHash: "$2a$12$hQ0nVzR70byjqMJI.1QYH.vWFBT9.rHf35ajlJBUq6yQ6fA5TrrW2", // ChangeMe123!
      },
    });
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: repairerRole.id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        roleId: repairerRole.id,
      },
    });
  }

  const progressRows = db.prepare("SELECT id, status FROM progress").all() as Array<{ id: number; status: string }>;
  const progressMap = new Map<number, { id: number; status: string }>();
  for (const row of progressRows) {
    progressMap.set(row.id, row);
  }

  const typeRows = db.prepare("SELECT id, text FROM typ").all() as Array<{ id: number; text: string }>;
  const typeMap = new Map<number, string>();
  for (const row of typeRows) {
    typeMap.set(row.id, row.text);
  }

  const repairs = db
    .prepare(
      `SELECT id, nummer, art, dateid, vorname, nachname, email, telefon, PLZ, Ort, gegenstand, defekt, reparateur,
              fix, material, bemerkungen, avisiert, rueckgabe, sicherheitstest, gelungen, progress
       FROM repairs`,
    )
    .all() as any[];

  const users = await prisma.user.findMany();
  const usersByName = new Map(users.map((u) => [u.fullName.toLowerCase(), u.id]));

  for (const row of repairs) {
    const assignedName = row.reparateur ? repairerMap.get(Number(row.reparateur)) : null;
    const assignedToUserId = assignedName ? usersByName.get(String(assignedName).toLowerCase()) ?? null : null;
    const progressEntry = progressMap.get(Number(row.progress));
    const status = mapStatus(progressEntry?.status);
    const productType = row.art ? typeMap.get(Number(row.art)) ?? null : null;
    const successful = mapSuccess(row.gelungen);
    const outcome = mapOutcome(row.gelungen);

    const existing = await prisma.repair.findFirst({ where: { legacyId: row.id } });
    const mappedData = {
      repairNumber: row.nummer ?? null,
      createdDate: dateMap.get(Number(row.dateid)) ?? null,
      firstName: row.vorname ?? null,
      lastName: row.nachname ?? null,
      email: row.email ?? null,
      phone: row.telefon ?? null,
      postcode: row.PLZ ? String(row.PLZ) : null,
      city: row.Ort ?? null,
      productType,
      itemName: row.gegenstand ?? null,
      problemDescription: row.defekt ?? null,
      fixDescription: row.fix ?? null,
      material: row.material ?? null,
      technicianNotes: row.bemerkungen ?? null,
      notified: row.avisiert === null ? null : Boolean(row.avisiert),
      returned: row.rueckgabe === null ? null : Boolean(row.rueckgabe),
      successful,
      outcome,
      safetyTested: row.sicherheitstest === null ? null : Boolean(row.sicherheitstest),
      status,
      assignedToUserId,
    };

    if (existing) {
      await prisma.repair.update({
        where: { id: existing.id },
        data: mappedData,
      });
    } else {
      await prisma.repair.create({
        data: {
          legacyId: row.id,
          publicRef: `LEGACY-${row.id}-${generatePublicRef()}`,
          ...mappedData,
        },
      });
    }
  }

  // eslint-disable-next-line no-console
  console.log(`Migrated ${repairs.length} repairs from SQLite.`);
  db.close();
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
