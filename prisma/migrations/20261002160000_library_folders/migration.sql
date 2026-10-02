CREATE TABLE "LibraryFolder" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "customCoverKey" TEXT,
    "customCoverMime" TEXT,
    "customCoverWidth" INTEGER,
    "customCoverHeight" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "libraryId" TEXT NOT NULL,
    "parentId" TEXT,
    "coverBookId" TEXT,

    CONSTRAINT "LibraryFolder_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Book" ADD COLUMN "folderId" TEXT;

CREATE UNIQUE INDEX "LibraryFolder_customCoverKey_key" ON "LibraryFolder"("customCoverKey");
CREATE UNIQUE INDEX "LibraryFolder_parentId_title_key" ON "LibraryFolder"("parentId", "title");
CREATE UNIQUE INDEX "LibraryFolder_root_title_key" ON "LibraryFolder"("libraryId", "title") WHERE "parentId" IS NULL;
CREATE INDEX "LibraryFolder_libraryId_parentId_idx" ON "LibraryFolder"("libraryId", "parentId");
CREATE INDEX "LibraryFolder_coverBookId_idx" ON "LibraryFolder"("coverBookId");
CREATE INDEX "Book_folderId_idx" ON "Book"("folderId");

ALTER TABLE "LibraryFolder" ADD CONSTRAINT "LibraryFolder_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "Library"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LibraryFolder" ADD CONSTRAINT "LibraryFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "LibraryFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LibraryFolder" ADD CONSTRAINT "LibraryFolder_coverBookId_fkey" FOREIGN KEY ("coverBookId") REFERENCES "Book"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Book" ADD CONSTRAINT "Book_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "LibraryFolder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
