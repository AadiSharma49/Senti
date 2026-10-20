-- AlterTable
ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "hardwareIdHash" TEXT;

-- One physical machine can have at most one currently-LINKED device row.
-- Partial so historical/unlinked rows (old installs, reset devices) never
-- collide with each other or block a fresh link.
CREATE UNIQUE INDEX IF NOT EXISTS "Device_hardwareIdHash_linked_key"
  ON "Device"("hardwareIdHash")
  WHERE "linked" = true AND "hardwareIdHash" IS NOT NULL;
