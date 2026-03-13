import { randomBytes } from "node:crypto";

export function generatePublicRef(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}
