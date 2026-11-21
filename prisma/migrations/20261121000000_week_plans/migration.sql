-- CreateTable
CREATE TABLE "WeekPlan" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "weekOf" DATE NOT NULL,
    "tasks" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeekPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WeekPlan_studentId_weekOf_key" ON "WeekPlan"("studentId", "weekOf");

-- AddForeignKey
ALTER TABLE "WeekPlan" ADD CONSTRAINT "WeekPlan_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

