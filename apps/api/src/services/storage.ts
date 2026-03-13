import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config.js";

export type StoredFile = {
  storageKey: string;
  absolutePath: string;
  checksum: string;
};

export async function ensureStoragePaths(): Promise<void> {
  await fs.mkdir(config.photoStorageDir, { recursive: true });
  await fs.mkdir(config.printSpoolDir, { recursive: true });
}

export async function storePhoto(buffer: Buffer, extension = "bin"): Promise<StoredFile> {
  const key = `${new Date().toISOString().slice(0, 10)}/${uuidv4()}.${extension}`;
  const fullPath = path.join(config.photoStorageDir, key);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, buffer);
  const checksum = createHash("sha256").update(buffer).digest("hex");
  return { storageKey: key, absolutePath: fullPath, checksum };
}

export function resolvePhotoPath(storageKey: string): string {
  return path.join(config.photoStorageDir, storageKey);
}
