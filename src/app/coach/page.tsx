import Link from "next/link";
import { requireSchoolUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { SplitBar } from "@/components/Status";
import { PasswordForm } from "@/components/PasswordForm";
import { dayInfo, latestResults } from "@/lib/records";
import { clockIn, fmtLong } from "@/lib/dates";
import { gradeShort } from "@/lib/subjects";

export const metadata = { title: "My classes" };

export default async function CoachHome() {
  const { user, school } = await requireSchoolUser(["COACH"]);
  const info = await dayInfo(school);
  const classes = await db.class.findMany({
    where: { schoolId: school.id, coaches: { some: { coachId: user.id } } }, orderBy: { name: "asc" },
    include: { students: { include: { student: { select: { id: true, active: true } } } } },
  });
  const ids = classes.flatMap(c => c.students.map(s => s.studentId));
  const [latest, marked] = await Promise.all([
    latestResults(ids),
    db.attendance.findMany({ where: { studentId: { in: ids }, date: info.date }, select: { studentId: true } }),
  ]);
  const markedSet = new Set(marked.map(m => m.studentId));
  return (
    <Shell user={user}>
      <div className="spread">
        <div><span className="eyebrow">{school.name}</span><h1>Good {clockIn(school.timezone) < "12:00" ? "morning" : "afternoon"}, {user.firstName}</h1></div>
        <span className="muted">{fmtLong(info.date)}{info.schoolDay ? "" : ` · No school: ${info.reason}`}</span>
      </div>
      {classes.length ? (
        <div className="grid2">{classes.map(c => {
          const sids = c.students.filter(s => s.student.active).map(s => s.studentId);
          let below = 0, at = 0, above = 0, assessed = 0;
          for (const id of sids) { const l = latest.get(id); if (!l) continue; assessed++; for (const r of l.results) { if (r.status === "below") below++; else if (r.status === "at") at++; else above++; } }
          const todo = sids.filter(id => !markedSet.has(id)).length;
          return (
            <Link key={c.id} href={`/coach/classes/${c.id}`} className="card" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="spread"><h2>{c.name}</h2><span className="muted small">Gr {c.grades.map(gradeShort).join(", ") || "any"}</span></div>
              <p className="muted small">{sids.length} students · {assessed} assessed</p>
              <SplitBar below={below} at={at} above={above} />
              <p className="small">{info.schoolDay ? (todo ? <b>Attendance: {todo} still to mark</b> : "Attendance done for today") : "No attendance today"}</p>
            </Link>
          );
        })}</div>
      ) : <div className="empty"><b>You don&apos;t have a class yet</b><span>Your school admin adds you to classes.</span></div>}
      <PasswordForm />
    </Shell>
  );
}
