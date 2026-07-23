-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "activity" TEXT,
ADD COLUMN     "reportedAt" TIMESTAMP(3),
ADD COLUMN     "vitals" TEXT;

