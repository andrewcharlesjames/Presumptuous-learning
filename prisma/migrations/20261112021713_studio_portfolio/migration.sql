-- CreateEnum
CREATE TYPE "Discipline" AS ENUM ('VISUAL_ARTS', 'MUSIC', 'DRAMA', 'DANCE', 'MEDIA_ARTS', 'WRITING');

-- CreateTable
CREATE TABLE "Artwork" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "discipline" "Discipline" NOT NULL,
    "title" TEXT NOT NULL,
    "reflection" TEXT NOT NULL DEFAULT '',
    "prompt" TEXT NOT NULL DEFAULT '',
    "textBody" TEXT NOT NULL DEFAULT '',
    "fileId" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Artwork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtFile" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArtFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtFeedback" (
    "id" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArtFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Artwork_fileId_key" ON "Artwork"("fileId");

-- CreateIndex
CREATE INDEX "Artwork_studentId_createdAt_idx" ON "Artwork"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "Artwork_schoolId_createdAt_idx" ON "Artwork"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "ArtFeedback_artworkId_idx" ON "ArtFeedback"("artworkId");

-- AddForeignKey
ALTER TABLE "Artwork" ADD CONSTRAINT "Artwork_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artwork" ADD CONSTRAINT "Artwork_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "ArtFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtFeedback" ADD CONSTRAINT "ArtFeedback_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtFeedback" ADD CONSTRAINT "ArtFeedback_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
