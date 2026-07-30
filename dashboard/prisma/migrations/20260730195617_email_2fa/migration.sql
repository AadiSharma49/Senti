-- AlterTable
ALTER TABLE "RemoteSession" ADD COLUMN     "emailCodeHash" TEXT,
ADD COLUMN     "emailCodeSentAt" TIMESTAMP(3);
