-- CreateEnum
CREATE TYPE "SkillState" AS ENUM ('LEARNING', 'MASTERED');

-- AlterTable
ALTER TABLE "PracticeSession" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'practice',
ADD COLUMN     "lessonId" TEXT;

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "skill" TEXT NOT NULL,
    "variant" INTEGER NOT NULL DEFAULT 1,
    "content" JSONB NOT NULL,
    "model" TEXT NOT NULL DEFAULT '',
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillProgress" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "skill" TEXT NOT NULL,
    "state" "SkillState" NOT NULL DEFAULT 'LEARNING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastScore" INTEGER NOT NULL DEFAULT 0,
    "lastTotal" INTEGER NOT NULL DEFAULT 0,
    "masteredAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lesson_subject_grade_skill_variant_key" ON "Lesson"("subject", "grade", "skill", "variant");

-- CreateIndex
CREATE INDEX "SkillProgress_studentId_state_idx" ON "SkillProgress"("studentId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "SkillProgress_studentId_subject_grade_skill_key" ON "SkillProgress"("studentId", "subject", "grade", "skill");

-- AddForeignKey
ALTER TABLE "SkillProgress" ADD CONSTRAINT "SkillProgress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
