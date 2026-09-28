-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('VIEWER', 'EDITOR');

-- CreateEnum
CREATE TYPE "BookFormat" AS ENUM ('PHYSICAL', 'EBOOK');

-- CreateEnum
CREATE TYPE "OwnershipState" AS ENUM ('HAVE', 'DONT_HAVE');

-- CreateEnum
CREATE TYPE "ReadingState" AS ENUM ('NOT_STARTED', 'READING', 'DONE');

-- CreateEnum
CREATE TYPE "LibraryView" AS ENUM ('LIST', 'GRID');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('USER', 'ADMIN', 'SYSTEM');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "loginId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "loginId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adminId" TEXT NOT NULL,

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminSetupToken" (
    "id" TEXT NOT NULL DEFAULT 'initial',
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminSetupToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Library" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "Library_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryMember" (
    "id" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "libraryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "LibraryMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryDisplaySettings" (
    "id" TEXT NOT NULL,
    "defaultView" "LibraryView" NOT NULL DEFAULT 'GRID',
    "showCover" BOOLEAN NOT NULL DEFAULT true,
    "showTitle" BOOLEAN NOT NULL DEFAULT true,
    "showAuthors" BOOLEAN NOT NULL DEFAULT true,
    "showGenre" BOOLEAN NOT NULL DEFAULT true,
    "showReading" BOOLEAN NOT NULL DEFAULT true,
    "showLocation" BOOLEAN NOT NULL DEFAULT false,
    "libraryId" TEXT NOT NULL,

    CONSTRAINT "LibraryDisplaySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Genre" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "parentId" TEXT,

    CONSTRAINT "Genre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Book" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authors" TEXT[],
    "description" TEXT NOT NULL DEFAULT '',
    "isbn10" TEXT,
    "isbn13" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "coverKey" TEXT,
    "coverMime" TEXT,
    "coverWidth" INTEGER,
    "coverHeight" INTEGER,
    "ownershipState" "OwnershipState" NOT NULL DEFAULT 'HAVE',
    "format" "BookFormat" NOT NULL DEFAULT 'PHYSICAL',
    "readingState" "ReadingState" NOT NULL DEFAULT 'NOT_STARTED',
    "readingStartedAt" TIMESTAMP(3),
    "readingFinishedAt" TIMESTAMP(3),
    "rating" INTEGER,
    "comment" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "libraryId" TEXT NOT NULL,
    "locationTagId" TEXT,

    CONSTRAINT "Book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookGenre" (
    "bookId" TEXT NOT NULL,
    "genreId" TEXT NOT NULL,

    CONSTRAINT "BookGenre_pkey" PRIMARY KEY ("bookId","genreId")
);

-- CreateTable
CREATE TABLE "LocationTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "libraryId" TEXT NOT NULL,

    CONSTRAINT "LocationTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "borrowerName" TEXT NOT NULL,
    "lentAt" TIMESTAMP(3) NOT NULL,
    "dueAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "bookId" TEXT NOT NULL,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "summary" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "libraryId" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_loginId_key" ON "User"("loginId");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_loginId_key" ON "Admin"("loginId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_tokenHash_key" ON "UserSession"("tokenHash");

-- CreateIndex
CREATE INDEX "UserSession_userId_idx" ON "UserSession"("userId");

-- CreateIndex
CREATE INDEX "UserSession_expiresAt_idx" ON "UserSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminSession_tokenHash_key" ON "AdminSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AdminSession_adminId_idx" ON "AdminSession"("adminId");

-- CreateIndex
CREATE INDEX "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminSetupToken_tokenHash_key" ON "AdminSetupToken"("tokenHash");

-- CreateIndex
CREATE INDEX "Library_ownerId_idx" ON "Library"("ownerId");

-- CreateIndex
CREATE INDEX "LibraryMember_userId_idx" ON "LibraryMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryMember_libraryId_userId_key" ON "LibraryMember"("libraryId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryDisplaySettings_libraryId_key" ON "LibraryDisplaySettings"("libraryId");

-- CreateIndex
CREATE UNIQUE INDEX "Genre_url_key" ON "Genre"("url");

-- CreateIndex
CREATE INDEX "Genre_parentId_idx" ON "Genre"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Genre_parentId_name_key" ON "Genre"("parentId", "name");

-- CreateIndex
CREATE INDEX "Book_libraryId_title_idx" ON "Book"("libraryId", "title");

-- CreateIndex
CREATE INDEX "Book_libraryId_isbn13_idx" ON "Book"("libraryId", "isbn13");

-- CreateIndex
CREATE INDEX "Book_locationTagId_idx" ON "Book"("locationTagId");

-- CreateIndex
CREATE INDEX "BookGenre_genreId_idx" ON "BookGenre"("genreId");

-- CreateIndex
CREATE UNIQUE INDEX "LocationTag_libraryId_name_key" ON "LocationTag"("libraryId", "name");

-- CreateIndex
CREATE INDEX "Loan_bookId_returnedAt_idx" ON "Loan"("bookId", "returnedAt");

-- CreateIndex
CREATE INDEX "Loan_dueAt_idx" ON "Loan"("dueAt");

-- CreateIndex
CREATE INDEX "AuditLog_libraryId_createdAt_idx" ON "AuditLog"("libraryId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorType_actorId_createdAt_idx" ON "AuditLog"("actorType", "actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Library" ADD CONSTRAINT "Library_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryMember" ADD CONSTRAINT "LibraryMember_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "Library"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryMember" ADD CONSTRAINT "LibraryMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryDisplaySettings" ADD CONSTRAINT "LibraryDisplaySettings_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "Library"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Genre" ADD CONSTRAINT "Genre_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Genre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Book" ADD CONSTRAINT "Book_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "Library"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Book" ADD CONSTRAINT "Book_locationTagId_fkey" FOREIGN KEY ("locationTagId") REFERENCES "LocationTag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookGenre" ADD CONSTRAINT "BookGenre_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookGenre" ADD CONSTRAINT "BookGenre_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "Genre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationTag" ADD CONSTRAINT "LocationTag_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "Library"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "Library"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Database-only invariants not expressible in the Prisma schema.
CREATE UNIQUE INDEX "Genre_root_name_key" ON "Genre"("name") WHERE "parentId" IS NULL;
CREATE UNIQUE INDEX "Loan_one_open_per_book_key" ON "Loan"("bookId") WHERE "returnedAt" IS NULL;
