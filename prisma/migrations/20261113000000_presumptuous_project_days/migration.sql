-- AlterTable
ALTER TABLE "ScheduleBlock" ADD COLUMN     "days" INTEGER[] DEFAULT ARRAY[0, 1, 2, 3, 4]::INTEGER[];


-- The Life Skills block is now the Presumptuous Project.
UPDATE "ScheduleBlock" SET "title" = 'Presumptuous Project', "focus" = 'Learn business and life skills, then build your business'
WHERE "kind" = 'LIFE_SKILLS' AND "title" = 'Life Skills';
