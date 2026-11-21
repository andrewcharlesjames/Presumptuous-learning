import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canViewStudent } from "@/lib/access";
import { auditView } from "@/lib/audit";
import { db } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { WeekView } from "@/components/WeekView";

export const metadata = { title: "Week" };

/** A student's week for their parents and coaches (read-only). */
export default async function StudentWeek({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string; m?: string }> }) {
  const { id } = await params;
  const viewer = await requireUser(["PARENT", "COACH", "SCHOOL_ADMIN", "STUDENT"]);
  if (!(await canViewStudent(viewer, id))) notFound();
  const student = await db.user.findUnique({ where: { id }, include: { school: true } });
  if (!student?.school) notFound();
  await auditView(viewer, id, "student.view");
  const sp = await searchParams;
  return (
    <Shell user={viewer}>
      <Link href={viewer.role === "PARENT" ? "/parent" : `/students/${id}`} className="small">← {viewer.role === "PARENT" ? "My children" : `${student.firstName}'s plan`}</Link>
      <WeekView student={student} school={student.school} base={`/students/${id}/week`} self={viewer.id === id} view={sp.view === "month" ? "month" : "week"} month={sp.m} />
    </Shell>
  );
}
