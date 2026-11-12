"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { setFlash } from "@/lib/flash";
import { isoDate, parseIsoDate, todayIn } from "@/lib/dates";
import type { AttendanceStatus } from "@prisma/client";

const STATUSES: AttendanceStatus[] = ["PRESENT", "LATE", "ABSENT", "EXCUSED"];

export async function saveAttendance(form: FormData) {
  const user = await requireUser(["COACH", "SCHOOL_ADMIN"]);
  const classId = String(form.get("classId") ?? "");
  const cls = await db.class.findFirst({
    where: { id: classId, schoolId: user.schoolId!, ...(user.role === "COACH" ? { coaches: { some: { coachId: user.id } } } : {}) },
    include: { students: true, school: true },
  });
  if (!cls) redirect("/coach");
  const date = parseIsoDate(String(form.get("date") ?? "")) ?? todayIn(cls.school.timezone);
  if (date > todayIn(cls.school.timezone)) {
    await setFlash({ tone: "error", text: "You can't take attendance for a future date." });
    redirect(`/coach/classes/${classId}?date=${isoDate(date)}`);
  }
  let n = 0;
  for (const { studentId } of cls.students) {
    const status = String(form.get(`status_${studentId}`) ?? "") as AttendanceStatus;
    if (!STATUSES.includes(status)) continue;
    const note = String(form.get(`note_${studentId}`) ?? "").slice(0, 200);
    await db.attendance.upsert({
      where: { studentId_date: { studentId, date } },
      create: { schoolId: cls.schoolId, studentId, date, status, note, markedById: user.id },
      update: { status, note, markedById: user.id },
    });
    n++;
  }
  await setFlash({ tone: "ok", text: `Attendance saved for ${n} student${n === 1 ? "" : "s"}.` });
  revalidatePath(`/coach/classes/${classId}`);
  redirect(`/coach/classes/${classId}?date=${isoDate(date)}`);
}
