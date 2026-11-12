-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN     "mode" TEXT NOT NULL DEFAULT 'fixed';

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "strand" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "correct" TEXT NOT NULL,
    "wrong1" TEXT NOT NULL,
    "wrong2" TEXT NOT NULL,
    "wrong3" TEXT NOT NULL,
    "explanation" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'builtin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeSession" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "skill" TEXT NOT NULL DEFAULT '',
    "questions" JSONB NOT NULL,
    "answers" JSONB NOT NULL,
    "correct" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PracticeSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Question_key_key" ON "Question"("key");

-- CreateIndex
CREATE INDEX "Question_subject_grade_active_idx" ON "Question"("subject", "grade", "active");

-- CreateIndex
CREATE INDEX "PracticeSession_studentId_startedAt_idx" ON "PracticeSession"("studentId", "startedAt");

-- AddForeignKey
ALTER TABLE "PracticeSession" ADD CONSTRAINT "PracticeSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
