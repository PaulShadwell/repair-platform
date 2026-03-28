import fs from "node:fs/promises";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { config } from "./config.js";
import { prisma } from "./prisma.js";
import { errorHandler } from "./middleware/error.js";
import { authRouter } from "./routes/auth.js";
import { repairsRouter } from "./routes/repairs.js";
import { usersRouter } from "./routes/users.js";
import { printersRouter } from "./routes/printers.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { printAgentRouter } from "./routes/printAgent.js";
import { profileRouter } from "./routes/profile.js";
import { customersRouter } from "./routes/customers.js";
import { brandingRouter } from "./routes/branding.js";
import { ensureStoragePaths } from "./services/storage.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: "5mb" }));
app.use(morgan("dev"));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRouter);
app.use("/api/repairs", repairsRouter);
app.use("/api/users", usersRouter);
app.use("/api/printers", printersRouter);
app.use("/api/print-agent", printAgentRouter);
app.use("/api/profile", profileRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/customers", customersRouter);
app.use("/api/branding", brandingRouter);
app.use(errorHandler);

async function ensureBootstrapData(): Promise<void> {
  await prisma.role.upsert({ where: { key: "ADMIN" }, update: {}, create: { key: "ADMIN" } });
  await prisma.role.upsert({ where: { key: "POS_USER" }, update: {}, create: { key: "POS_USER" } });
  await prisma.role.upsert({ where: { key: "SUPERVISOR" }, update: {}, create: { key: "SUPERVISOR" } });
  await prisma.role.upsert({ where: { key: "REPAIRER" }, update: {}, create: { key: "REPAIRER" } });
  await fs.mkdir(config.photoStorageDir, { recursive: true });
  await fs.mkdir(config.printSpoolDir, { recursive: true });
}

async function main(): Promise<void> {
  await ensureStoragePaths();
  await ensureBootstrapData();
  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`API listening on http://localhost:${config.port}`);
  });
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
