-- CreateTable
CREATE TABLE "RemoteSignal" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "fromViewer" BOOLEAN NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemoteSignal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RemoteSignal_sessionId_fromViewer_createdAt_idx" ON "RemoteSignal"("sessionId", "fromViewer", "createdAt");

-- AddForeignKey
ALTER TABLE "RemoteSignal" ADD CONSTRAINT "RemoteSignal_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RemoteSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
