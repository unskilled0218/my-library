CREATE TYPE "Language" AS ENUM ('KO', 'EN');

ALTER TABLE "UserDisplaySettings"
ADD COLUMN "language" "Language" NOT NULL DEFAULT 'KO';

UPDATE "UserDisplaySettings" SET "language" = 'KO';
