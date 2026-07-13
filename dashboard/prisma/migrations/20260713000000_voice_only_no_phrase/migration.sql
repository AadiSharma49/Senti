-- Unlock is voice-only: drop the retired wake-phrase / security-mode columns.
-- SQLite drops columns by rebuilding the table; all other data is preserved.
PRAGMA foreign_keys=OFF;

-- VoiceProfile: drop `phrase`
CREATE TABLE "new_VoiceProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "embedding" TEXT NOT NULL,
    "sampleCount" INTEGER NOT NULL DEFAULT 0,
    "modelId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VoiceProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_VoiceProfile" ("id", "userId", "embedding", "sampleCount", "modelId", "createdAt", "updatedAt")
SELECT "id", "userId", "embedding", "sampleCount", "modelId", "createdAt", "updatedAt" FROM "VoiceProfile";
DROP TABLE "VoiceProfile";
ALTER TABLE "new_VoiceProfile" RENAME TO "VoiceProfile";
CREATE UNIQUE INDEX "VoiceProfile_userId_key" ON "VoiceProfile"("userId");

-- Policy: drop `securityMode`
CREATE TABLE "new_Policy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "voiceThreshold" REAL NOT NULL DEFAULT 0.5,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lockoutDuration" INTEGER NOT NULL DEFAULT 30,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Policy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Policy" ("id", "userId", "voiceThreshold", "maxAttempts", "lockoutDuration", "updatedAt")
SELECT "id", "userId", "voiceThreshold", "maxAttempts", "lockoutDuration", "updatedAt" FROM "Policy";
DROP TABLE "Policy";
ALTER TABLE "new_Policy" RENAME TO "Policy";
CREATE UNIQUE INDEX "Policy_userId_key" ON "Policy"("userId");

PRAGMA foreign_keys=ON;
