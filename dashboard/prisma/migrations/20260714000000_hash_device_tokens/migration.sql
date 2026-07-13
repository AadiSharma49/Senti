-- DropIndex
DROP INDEX "Device_token_key";

-- AlterTable
ALTER TABLE "Device" DROP COLUMN "token",
ADD COLUMN     "tokenHash" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Device_tokenHash_key" ON "Device"("tokenHash");
