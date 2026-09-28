-- Create account-level display settings, preserving the earliest library settings for each owner.
CREATE TABLE "UserDisplaySettings" (
    "id" TEXT NOT NULL,
    "defaultView" "LibraryView" NOT NULL DEFAULT 'GRID',
    "showCover" BOOLEAN NOT NULL DEFAULT true,
    "showTitle" BOOLEAN NOT NULL DEFAULT true,
    "showAuthors" BOOLEAN NOT NULL DEFAULT true,
    "showGenre" BOOLEAN NOT NULL DEFAULT true,
    "showReading" BOOLEAN NOT NULL DEFAULT true,
    "showLocation" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,

    CONSTRAINT "UserDisplaySettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "UserDisplaySettings" (
    "id", "defaultView", "showCover", "showTitle", "showAuthors",
    "showGenre", "showReading", "showLocation", "userId"
)
SELECT
    'user_settings_' || md5(u."id"),
    COALESCE(canonical."defaultView", 'GRID'::"LibraryView"),
    COALESCE(canonical."showCover", true),
    COALESCE(canonical."showTitle", true),
    COALESCE(canonical."showAuthors", true),
    COALESCE(canonical."showGenre", true),
    COALESCE(canonical."showReading", true),
    COALESCE(canonical."showLocation", false),
    u."id"
FROM "User" u
LEFT JOIN LATERAL (
    SELECT settings.*
    FROM "Library" library
    JOIN "LibraryDisplaySettings" settings ON settings."libraryId" = library."id"
    WHERE library."ownerId" = u."id"
    ORDER BY library."createdAt" ASC, library."id" ASC
    LIMIT 1
) canonical ON true;

CREATE UNIQUE INDEX "UserDisplaySettings_userId_key" ON "UserDisplaySettings"("userId");
ALTER TABLE "UserDisplaySettings" ADD CONSTRAINT "UserDisplaySettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Move shelf tags to their library owner's account and merge duplicate names.
ALTER TABLE "LocationTag" ADD COLUMN "userId" TEXT;

UPDATE "LocationTag" tag
SET "userId" = library."ownerId"
FROM "Library" library
WHERE library."id" = tag."libraryId";

WITH canonical AS (
    SELECT "userId", "name", MIN("id") AS "id"
    FROM "LocationTag"
    GROUP BY "userId", "name"
), remapped AS (
    SELECT tag."id" AS old_id, canonical."id" AS new_id
    FROM "LocationTag" tag
    JOIN canonical ON canonical."userId" = tag."userId" AND canonical."name" = tag."name"
)
UPDATE "Book" book
SET "locationTagId" = remapped.new_id
FROM remapped
WHERE book."locationTagId" = remapped.old_id;

DELETE FROM "LocationTag" tag
USING "LocationTag" canonical
WHERE tag."userId" = canonical."userId"
  AND tag."name" = canonical."name"
  AND tag."id" > canonical."id";

ALTER TABLE "LocationTag" DROP CONSTRAINT "LocationTag_libraryId_fkey";
DROP INDEX "LocationTag_libraryId_name_key";
ALTER TABLE "LocationTag" DROP COLUMN "libraryId";
ALTER TABLE "LocationTag" ALTER COLUMN "userId" SET NOT NULL;
CREATE UNIQUE INDEX "LocationTag_userId_name_key" ON "LocationTag"("userId", "name");
ALTER TABLE "LocationTag" ADD CONSTRAINT "LocationTag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP TABLE "LibraryDisplaySettings";
