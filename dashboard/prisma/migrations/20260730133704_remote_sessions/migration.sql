-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "remotePinHash" TEXT;

-- CreateTable
CREATE TABLE "RemoteSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "viewerDeviceId" TEXT NOT NULL,
    "targetDeviceId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "heartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "RemoteSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemoteInput" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemoteInput_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RemoteSession_targetDeviceId_state_idx" ON "RemoteSession"("targetDeviceId", "state");

-- CreateIndex
CREATE INDEX "RemoteInput_sessionId_createdAt_idx" ON "RemoteInput"("sessionId", "createdAt");

-- AddForeignKey
ALTER TABLE "RemoteSession" ADD CONSTRAINT "RemoteSession_targetDeviceId_fkey" FOREIGN KEY ("targetDeviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemoteInput" ADD CONSTRAINT "RemoteInput_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RemoteSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
