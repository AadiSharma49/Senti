BEGIN;

ALTER TABLE "Device"
  ADD COLUMN "remoteAuthFailures" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "remoteAuthExpiresAt" TIMESTAMP(3);

-- The old unsalted digests can't be converted without the original PINs.
-- Require the owner to choose a PIN again on the target PC.
UPDATE "Device" SET "remotePinHash" = NULL
WHERE "remotePinHash" ~ '^[a-f0-9]{64}$';

-- Pending challenges must be reissued. Already verified sessions stay active.
UPDATE "RemoteSession" SET "state" = 'ended', "endedAt" = CURRENT_TIMESTAMP
WHERE "state" = 'pending';
UPDATE "RemoteSession" SET "emailCodeHash" = NULL, "emailCodeSentAt" = NULL
WHERE "emailCodeHash" IS NOT NULL;

COMMIT;
