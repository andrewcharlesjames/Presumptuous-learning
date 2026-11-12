import Link from "next/link";
import { requireSchoolUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { SplitBar } from "@/components/Status";
import { PasswordForm } from "@/components/PasswordForm";
import { dayInfo, latestResults } from "@/lib/records";
import { addDays, clockIn, fmtLong, isoDate, todayIn } from "@/lib/dates";
import { gradeShort } from "@/lib/subjects";
import { completion, describe } from "@/lib/assignments";
import { dayStatuses } from "@/lib/schoolday";
import { moodLabel } from "@/lib/prompts";

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
  const activeIds = [...new Set(classes.flatMap(c => c.students.filter(s => s.student.active).map(s => s.studentId)))];
  const recentFrom = addDays(info.date, -6);
  const [people, stuck, openWork, lowToday, recent] = await Promise.all([
    db.user.findMany({ where: { id: { in: activeIds } }, select: { id: true, firstName: true, lastName: true, createdAt: true } }),
    db.skillProgress.findMany({ where: { studentId: { in: activeIds }, state: "LEARNING", attempts: { gte: 3 } }, select: { studentId: true, skill: true } }),
    db.assignment.findMany({ where: { targets: { some: { studentId: { in: activeIds } } }, dueDate: { lt: info.date } }, include: { targets: true } }),
    db.dailyLog.findMany({ where: { studentId: { in: activeIds }, date: info.date, mood: { lte: 2 } }, select: { studentId: true, mood: true } }),
    dayStatuses(school, activeIds, recentFrom, info.date),
  ]);
  const doneWork = await completion(openWork);
  const reasons = new Map<string, string[]>();
  const add = (id: string, r: string) => reasons.set(id, [...(reasons.get(id) ?? []), r]);
  for (const k of stuck) add(k.studentId, `stuck on ${k.skill} after 3 lessons`);
  for (const a of openWork) for (const t of a.targets) if (activeIds.includes(t.studentId) && !doneWork.has(`${a.id}:${t.studentId}`)) add(t.studentId, `overdue: ${describe(a)}`);
  for (const l of lowToday) add(l.studentId, `checked in feeling ${moodLabel(l.mood)} today`);
  for (const p of people) {
    const days = (recent.get(p.id) ?? []).filter(d => d.schoolDay && d.date < isoDate(info.date) && d.date >= isoDate(todayIn(school.timezone, p.createdAt)));
    if (days.length >= 3 && days.slice(-3).every(d => d.learning === 0)) add(p.id, "no lessons or practice in the last 3 school days");
  }
  const attention = people.filter(p => reasons.has(p.id)).sort((a, b) => reasons.get(b.id)!.length - reasons.get(a.id)!.length);
  return (
    <Shell user={user}>
      <div className="spread">
        <div><span className="eyebrow">{school.name}</span><h1>Good {clockIn(school.timezone) < "12:00" ? "morning" : "afternoon"}, {user.firstName}</h1></div>
        <span className="muted">{fmtLong(info.date)}{info.schoolDay ? "" : ` · No school: ${info.reason}`}</span>
      </div>
      {attention.length > 0 && (
        <section className="card" style={{ borderColor: "var(--below)" }}>
          <div className="spread"><h2>Needs attention</h2><span className="small muted">{attention.length} student{attention.length === 1 ? "" : "s"}</span></div>
          <div className="stack" style={{ gap: 8 }}>{attention.map(p => (
            <div key={p.id} className="row" style={{ gap: 8, alignItems: "baseline" }}>
              <Link href={`/students/${p.id}`}><b>{p.firstName} {p.lastName}</b></Link>
              <span className="small">{reasons.get(p.id)!.slice(0, 3).join(" · ")}{reasons.get(p.id)!.length > 3 ? ` · and ${reasons.get(p.id)!.length - 3} more` : ""}</span>
            </div>
          ))}</div>
        </section>
      )}

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
