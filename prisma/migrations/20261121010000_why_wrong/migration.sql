-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "whyWrong" TEXT[] DEFAULT ARRAY[]::TEXT[];

