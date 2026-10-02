CREATE TYPE "BookFileType" AS ENUM ('EPUB', 'PDF');

CREATE TABLE "BookFile" (
    "id" TEXT NOT NULL,
    "type" "BookFileType" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "bookId" TEXT NOT NULL,

    CONSTRAINT "BookFile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BookFile_storageKey_key" ON "BookFile"("storageKey");
CREATE UNIQUE INDEX "BookFile_bookId_type_key" ON "BookFile"("bookId", "type");
CREATE INDEX "BookFile_bookId_idx" ON "BookFile"("bookId");

ALTER TABLE "BookFile"
ADD CONSTRAINT "BookFile_bookId_fkey"
FOREIGN KEY ("bookId") REFERENCES "Book"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
