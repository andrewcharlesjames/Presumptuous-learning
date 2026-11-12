import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSchoolUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { ArtCard } from "@/components/ArtCard";
import { addDays } from "@/lib/dates";

export const metadata = { title: "Class studio" };

export default async function ClassStudio({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ all?: string }> }) {
  const { id } = await params;
  const { all } = await searchParams;
  const { user, school } = await requireSchoolUser(["COACH", "SCHOOL_ADMIN"]);
  const cls = await db.class.findFirst({
    where: { id, schoolId: school.id, ...(user.role === "COACH" ? { coaches: { some: { coachId: user.id } } } : {}) },
    include: { students: { include: { student: { select: { id: true, firstName: true, lastName: true } } } } },
  });
  if (!cls) notFound();
  const ids = cls.students.map(s => s.studentId);
  const names = new Map(cls.students.map(s => [s.studentId, `${s.student.firstName} ${s.student.lastName}`]));
  const works = await db.artwork.findMany({
    where: { studentId: { in: ids }, ...(all ? {} : { createdAt: { gte: addDays(new Date(), -14) } }) },
    include: { file: { select: { id: true, mime: true } }, feedback: { include: { author: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" }, take: 90,
  });
  const waiting = works.filter(w => w.feedback.length === 0).length;
  const returnTo = `/coach/classes/${cls.id}/studio${all ? "?all=1" : ""}`;
  return (
    <Shell user={user}>
      <div className="spread">
        <div><Link href={`/coach/classes/${cls.id}`} className="small">← {cls.name}</Link><h1>Class studio</h1>
          <p className="muted small" style={{ marginTop: 6 }}>{works.length} piece{works.length === 1 ? "" : "s"} {all ? "in total" : "in the last 14 days"} · {waiting} without feedback yet</p></div>
        <Link className="btn" href={all ? `/coach/classes/${cls.id}/studio` : `/coach/classes/${cls.id}/studio?all=1`}>{all ? "Last 14 days" : "Show all work"}</Link>
      </div>
      {works.length ? (
        <div className="grid3" style={{ alignItems: "start" }}>{works.map(a => (
          <ArtCard key={a.id} art={a} tz={school.timezone} studentName={names.get(a.studentId)} canFeature canDelete={false} canGiveFeedback returnTo={returnTo} />
        ))}</div>
      ) : <div className="empty"><b>No work handed in yet</b><span>Students hand in work from their Studio. It appears here for your feedback.</span></div>}
    </Shell>
  );
}
