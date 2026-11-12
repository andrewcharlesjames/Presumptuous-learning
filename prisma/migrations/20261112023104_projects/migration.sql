-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('LIFE_SKILLS', 'PURPOSE');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('TODO', 'SUBMITTED', 'NEEDS_WORK', 'APPROVED');

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "launchDay" DATE;

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" "ProjectType" NOT NULL,
    "schoolYear" INTEGER NOT NULL,
    "interview" JSONB,
    "ideas" JSONB,
    "title" TEXT NOT NULL DEFAULT '',
    "oneLiner" TEXT NOT NULL DEFAULT '',
    "problem" TEXT NOT NULL DEFAULT '',
    "audience" TEXT NOT NULL DEFAULT '',
    "plan" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMilestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "dueDate" DATE NOT NULL,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'TODO',
    "evidence" TEXT NOT NULL DEFAULT '',
    "link" TEXT NOT NULL DEFAULT '',
    "feedback" TEXT NOT NULL DEFAULT '',
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,

    CONSTRAINT "ProjectMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Project_schoolId_idx" ON "Project"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_studentId_type_schoolYear_key" ON "Project"("studentId", "type", "schoolYear");

-- CreateIndex
CREATE INDEX "ProjectMilestone_projectId_position_idx" ON "ProjectMilestone"("projectId", "position");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMilestone" ADD CONSTRAINT "ProjectMilestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
