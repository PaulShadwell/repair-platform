-- Add forced password change flag for admin password resets.
ALTER TABLE "User"
ADD COLUMN "forcePasswordChange" BOOLEAN NOT NULL DEFAULT false;

-- Add generic repair change history audit table.
CREATE TABLE "RepairChangeHistory" (
  "id" TEXT NOT NULL,
  "repairId" TEXT NOT NULL,
  "changedById" TEXT,
  "changeType" TEXT NOT NULL,
  "changedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "previousData" JSONB,
  "nextData" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RepairChangeHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RepairChangeHistory_repairId_createdAt_idx"
ON "RepairChangeHistory"("repairId", "createdAt");

ALTER TABLE "RepairChangeHistory"
ADD CONSTRAINT "RepairChangeHistory_repairId_fkey"
FOREIGN KEY ("repairId") REFERENCES "Repair"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RepairChangeHistory"
ADD CONSTRAINT "RepairChangeHistory_changedById_fkey"
FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
