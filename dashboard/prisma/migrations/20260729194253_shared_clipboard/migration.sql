-- CreateTable
CREATE TABLE "SharedClipboard" (
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "fromDeviceId" TEXT NOT NULL,
    "fromName" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharedClipboard_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "SharedClipboard" ADD CONSTRAINT "SharedClipboard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
