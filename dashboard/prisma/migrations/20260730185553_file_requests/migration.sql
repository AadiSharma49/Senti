-- CreateTable
CREATE TABLE "FileRequest" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "root" TEXT NOT NULL,
    "relPath" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT 'pending',
    "payload" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ranAt" TIMESTAMP(3),

    CONSTRAINT "FileRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FileRequest_deviceId_state_idx" ON "FileRequest"("deviceId", "state");

-- AddForeignKey
ALTER TABLE "FileRequest" ADD CONSTRAINT "FileRequest_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
