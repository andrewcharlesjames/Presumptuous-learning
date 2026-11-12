-- CreateTable
CREATE TABLE "DailyLog" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "mood" INTEGER,
    "goal" TEXT NOT NULL DEFAULT '',
    "checkedInAt" TIMESTAMP(3),
    "learned" TEXT NOT NULL DEFAULT '',
    "question" TEXT NOT NULL DEFAULT '',
    "effort" INTEGER,
    "reflectedAt" TIMESTAMP(3),
    "artsDone" BOOLEAN NOT NULL DEFAULT false,
    "lifeDone" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyLog_studentId_date_key" ON "DailyLog"("studentId", "date");

-- AddForeignKey
ALTER TABLE "DailyLog" ADD CONSTRAINT "DailyLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
