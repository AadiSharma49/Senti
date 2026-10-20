-- DropForeignKey
ALTER TABLE "VoiceProfile" DROP CONSTRAINT IF EXISTS "VoiceProfile_userId_fkey";
ALTER TABLE "Policy" DROP CONSTRAINT IF EXISTS "Policy_userId_fkey";
ALTER TABLE "UnlockEvent" DROP CONSTRAINT IF EXISTS "UnlockEvent_userId_fkey";
ALTER TABLE "UnlockEvent" DROP CONSTRAINT IF EXISTS "UnlockEvent_deviceId_fkey";

-- DropTable
DROP TABLE IF EXISTS "VoiceProfile";
DROP TABLE IF EXISTS "Policy";
DROP TABLE IF EXISTS "UnlockEvent";

-- AlterTable
ALTER TABLE "Device" DROP COLUMN IF EXISTS "voiceEnrolled";
