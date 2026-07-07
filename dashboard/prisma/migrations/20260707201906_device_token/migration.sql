/*
  Warnings:

  - Added the required column `token` to the `Device` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Device" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "os" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'offline',
    "voiceEnrolled" BOOLEAN NOT NULL DEFAULT false,
    "token" TEXT NOT NULL,
    "linked" BOOLEAN NOT NULL DEFAULT false,
    "lastSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Device_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Device" ("createdAt", "id", "lastSeen", "name", "os", "status", "userId", "voiceEnrolled") SELECT "createdAt", "id", "lastSeen", "name", "os", "status", "userId", "voiceEnrolled" FROM "Device";
DROP TABLE "Device";
ALTER TABLE "new_Device" RENAME TO "Device";
CREATE UNIQUE INDEX "Device_token_key" ON "Device"("token");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
