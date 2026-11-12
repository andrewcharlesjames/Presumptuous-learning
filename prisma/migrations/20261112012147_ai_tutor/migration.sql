-- AlterTable
ALTER TABLE "School" ADD COLUMN     "aiTutor" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "TutorExplanation" (
    "key" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TutorExplanation_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "TutorRequest" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TutorRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TutorRequest_studentId_createdAt_idx" ON "TutorRequest"("studentId", "createdAt");
