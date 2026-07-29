-- CreateTable
CREATE TABLE "ScreenFrame" (
    "deviceId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "sharing" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScreenFrame_pkey" PRIMARY KEY ("deviceId")
);

-- AddForeignKey
ALTER TABLE "ScreenFrame" ADD CONSTRAINT "ScreenFrame_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
