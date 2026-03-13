-- CreateEnum
CREATE TYPE "PrintJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "PrintAgent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "printerProfileId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3),

    CONSTRAINT "PrintAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrintJob" (
    "id" TEXT NOT NULL,
    "repairId" TEXT NOT NULL,
    "printerProfileId" TEXT NOT NULL,
    "payload" BYTEA NOT NULL,
    "status" "PrintJobStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "claimedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "agentId" TEXT,

    CONSTRAINT "PrintJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrinterPairingCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "printerProfileId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrinterPairingCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PrintAgent_token_key" ON "PrintAgent"("token");

-- CreateIndex
CREATE INDEX "PrintAgent_printerProfileId_isActive_idx" ON "PrintAgent"("printerProfileId", "isActive");

-- CreateIndex
CREATE INDEX "PrintJob_printerProfileId_status_createdAt_idx" ON "PrintJob"("printerProfileId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PrinterPairingCode_code_key" ON "PrinterPairingCode"("code");

-- CreateIndex
CREATE INDEX "PrinterPairingCode_printerProfileId_expiresAt_idx" ON "PrinterPairingCode"("printerProfileId", "expiresAt");

-- AddForeignKey
ALTER TABLE "PrintAgent" ADD CONSTRAINT "PrintAgent_printerProfileId_fkey" FOREIGN KEY ("printerProfileId") REFERENCES "PrinterProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_repairId_fkey" FOREIGN KEY ("repairId") REFERENCES "Repair"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_printerProfileId_fkey" FOREIGN KEY ("printerProfileId") REFERENCES "PrinterProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "PrintAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrinterPairingCode" ADD CONSTRAINT "PrinterPairingCode_printerProfileId_fkey" FOREIGN KEY ("printerProfileId") REFERENCES "PrinterProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrinterPairingCode" ADD CONSTRAINT "PrinterPairingCode_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
