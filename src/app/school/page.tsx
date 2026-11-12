import Link from "next/link";
import { requireSchoolUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { SplitBar } from "@/components/Status";
import { dayInfo, latestResults } from "@/lib/records";
import { SUBJECTS, gradeName, plural } from "@/lib/subjects";
import { fmtLong } from "@/lib/dates";
import type { Status } from "@/lib/assessment";

export const metadata = { title: "School overview" };

export default async function SchoolOverview() {
  const { user, school } = await requireSchoolUser(["SCHOOL_ADMIN"]);
  const [students, coachCount, parentCount, classCount, info] = await Promise.all([
    db.user.findMany({ where: { schoolId: school.id, role: "STUDENT", active: true }, select: { id: true, firstName: true, lastName: true, grade: true } }),
    db.user.count({ where: { schoolId: school.id, role: "COACH", active: true } }),
    db.user.count({ where: { schoolId: school.id, role: "PARENT", active: true } }),
    db.class.count({ where: { schoolId: school.id } }),
    dayInfo(school),
  ]);
  const latest = await latestResults(students.map(s => s.id));
  const assessed = students.filter(s => latest.has(s.id));
  const att = await db.attendance.groupBy({ by: ["status"], where: { schoolId: school.id, date: info.date }, _count: true });
  const attCount = Object.fromEntries(att.map(a => [a.status, a._count])) as Record<string, number>;
  const marked = Object.values(attCount).reduce((a, b) => a + b, 0);

  // subject × status distribution across assessed students
  const dist = new Map<string, Record<Status, number>>();
  let below = 0, at = 0, above = 0;
  for (const s of assessed) for (const r of latest.get(s.id)!.results) {
    const d = dist.get(r.sid) ?? { below: 0, at: 0, above: 0 };
    d[r.status]++; dist.set(r.sid, d);
    if (r.status === "below") below++; else if (r.status === "at") at++; else above++;
  }
  const needs = assessed
    .map(s => ({ s, n: latest.get(s.id)!.results.filter(r => r.status === "below").length }))
    .filter(x => x.n >= 2).sort((a, b) => b.n - a.n).slice(0, 8);

  return (
    <Shell user={user}>
      <div className="spread">
        <div><span className="eyebrow">{school.name} · code {school.code}</span><h1>School overview</h1></div>
        <span className="muted">{fmtLong(info.date)}{info.schoolDay ? "" : ` · ${info.reason}`}</span>
      </div>

      {students.length === 0 ? (
        <div className="empty">
          <b>Set up your school in three steps</b>
          <span>1. Add students and {plural(school.coachTitle).toLowerCase()} · 2. Create classes · 3. Check your school day and calendar</span>
          <Link className="btn primary" href="/school/people">Add people</Link>
        </div>
      ) : (
        <>
          <section className="grid4">
            <div className="stat"><span className="n">{students.length}</span><span>students</span></div>
            <div className="stat"><span className="n">{coachCount}</span><span>{plural(school.coachTitle).toLowerCase()}</span></div>
            <div className="stat"><span className="n">{classCount}</span><span>classes</span></div>
            <div className="stat"><span className="n">{parentCount}</span><span>parents connected</span></div>
          </section>

          <section className="grid2">
            <div className="card">
              <h2>Placement across the school</h2>
              <p className="muted small">{assessed.length} of {students.length} students assessed. Each bar shows students below, at and above grade level.</p>
              {assessed.length ? (
                <div className="stack" style={{ gap: 10 }}>
                  <div className="row small"><SplitBar below={below} at={at} above={above} /><span className="num">{Math.round((above / Math.max(1, below + at + above)) * 100)}% of subject placements are above grade level</span></div>
                  {SUBJECTS.filter(s => dist.has(s.id)).map(s => {
                    const d = dist.get(s.id)!;
                    return (
                      <div key={s.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.3fr) auto", gap: 10, alignItems: "center" }}>
                        <span className="small">{s.name(5)}</span><SplitBar {...d} />
                        <span className="small muted num">{d.below} · {d.at} · {d.above}</span>
                      </div>
                    );
                  })}
                </div>
              ) : <p className="muted">No completed assessments yet. Students start one from their Today screen.</p>}
            </div>
            <div className="card">
              <h2>Today&apos;s attendance</h2>
              {info.schoolDay ? (
                <>
                  <p className="num">{marked} of {students.length} marked · {attCount.PRESENT ?? 0} present · {attCount.LATE ?? 0} late · {attCount.ABSENT ?? 0} absent · {attCount.EXCUSED ?? 0} excused</p>
                  <p className="muted small">{plural(school.coachTitle)} take attendance from their class page.</p>
                </>
              ) : <p className="muted">No school today ({info.reason}).</p>}
              <h3>Needs attention</h3>
              {needs.length ? (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {needs.map(({ s, n }) => <li key={s.id}><Link href={`/students/${s.id}`}>{s.firstName} {s.lastName}</Link> <span className="muted small">{gradeName(s.grade ?? 0)} · below grade level in {n} subjects</span></li>)}
                </ul>
              ) : <p className="muted small">No student is below grade level in two or more subjects.</p>}
            </div>
          </section>
        </>
      )}
    </Shell>
  );
}
