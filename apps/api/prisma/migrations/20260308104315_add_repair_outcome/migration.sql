-- CreateEnum
CREATE TYPE "RepairOutcome" AS ENUM ('YES', 'PARTIAL', 'NO');

-- AlterTable
ALTER TABLE "Repair" ADD COLUMN     "outcome" "RepairOutcome";
