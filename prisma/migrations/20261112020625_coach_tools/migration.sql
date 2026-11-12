-- CreateEnum
CREATE TYPE "AssignmentKind" AS ENUM ('MASTER_SKILL', 'PRACTICE', 'ASSESSMENT');

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "kind" "AssignmentKind" NOT NULL,
    "subject" TEXT NOT NULL DEFAULT '',
    "grade" INTEGER NOT NULL DEFAULT 0,
    "skill" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "dueDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentTarget" (
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,

    CONSTRAINT "AssignmentTarget_pkey" PRIMARY KEY ("assignmentId","studentId")
);

-- CreateTable
CREATE TABLE "CoachNote" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoachNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Assignment_schoolId_createdAt_idx" ON "Assignment"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "AssignmentTarget_studentId_idx" ON "AssignmentTarget"("studentId");

-- CreateIndex
CREATE INDEX "CoachNote_studentId_createdAt_idx" ON "CoachNote"("studentId", "createdAt");

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentTarget" ADD CONSTRAINT "AssignmentTarget_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentTarget" ADD CONSTRAINT "AssignmentTarget_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachNote" ADD CONSTRAINT "CoachNote_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachNote" ADD CONSTRAINT "CoachNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
