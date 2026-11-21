-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'placement',
ADD COLUMN     "startAt" JSONB;

