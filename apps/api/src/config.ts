import dotenv from "dotenv";
import path from "node:path";

dotenv.config();

export const config = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl: process.env.DATABASE_URL ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "change-this-in-production",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "30d",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  photoStorageDir: path.resolve(process.env.PHOTO_STORAGE_DIR ?? "./storage/photos"),
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? "http://localhost:5173",
  printSpoolDir: path.resolve(process.env.PRINT_SPOOL_DIR ?? "./storage/print-spool"),
  defaultPrinterMode: process.env.DEFAULT_PRINTER_MODE ?? "spool",
  systemPrinterName: process.env.SYSTEM_PRINTER_NAME ?? "",
  printRelayUrl: process.env.PRINT_RELAY_URL ?? "",
  printRelayToken: process.env.PRINT_RELAY_TOKEN ?? "",
  printRelayTimeoutMs: Number(process.env.PRINT_RELAY_TIMEOUT_MS ?? 10000),
};
