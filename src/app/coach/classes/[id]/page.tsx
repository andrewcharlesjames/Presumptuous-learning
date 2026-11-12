import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSchoolUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { SubjectChips } from "@/components/Status";
import { dayInfo, latestResults } from "@/lib/records";
import { addDays, fmtLong, fmtStamp, isoDate, parseIsoDate, todayIn } from "@/lib/dates";
import { gradeShort, plural } from "@/lib/subjects";
import { saveAttendance } from "../../actions";
import { resetPassword } from "@/app/school/actions";

const OPTIONS = [["PRESENT", "Present"], ["LATE", "Late"], ["ABSENT", "Absent"], ["EXCUSED", "Excused"]] as const;

export default async function ClassView({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ date?: string }> }) {
  const { id } = await params;
  const { date: dateParam } = await searchParams;
  const { user, school } = await requireSchoolUser(["COACH", "SCHOOL_ADMIN"]);
  const cls = await db.class.findFirst({
    where: { id, schoolId: school.id, ...(user.role === "COACH" ? { coaches: { some: { coachId: user.id } } } : {}) },
    include: {
      coaches: { include: { coach: true } },
      students: { include: { student: true }, orderBy: { student: { lastName: "asc" } } },
    },
  });
  if (!cls) notFound();
  const today = todayIn(school.timezone);
  const date = (dateParam && parseIsoDate(dateParam)) || today;
  const info = await dayInfo(school, date);
  const students = cls.students.map(s => s.student).filter(s => s.active);
  const ids = students.map(s => s.id);
  const [latest, att, inProgress] = await Promise.all([
    latestResults(ids),
    db.attendance.findMany({ where: { studentId: { in: ids }, date } }),
    db.assessment.findMany({ where: { studentId: { in: ids }, status: "IN_PROGRESS" }, select: { studentId: true } }),
  ]);
  const attBy = new Map(att.map(a => [a.studentId, a]));
  const going = new Set(inProgress.map(a => a.studentId));
  const returnTo = `/coach/classes/${cls.id}`;

  return (
    <Shell user={user}>
      <div className="spread">
        <div>
          <Link href={user.role === "COACH" ? "/coach" : "/school/classes"} className="small">← {user.role === "COACH" ? "My classes" : "Classes"}</Link>
          <h1>{cls.name}</h1>
          <p className="muted small">{plural(school.coachTitle)}: {cls.coaches.map(c => `${c.coach.firstName} ${c.coach.lastName}`).join(", ") || "none"} · Students sign in with school code <b className="num">{school.code}</b></p>
        </div>
      </div>

      <section className="stack">
        <h2>Where each student is</h2>
        {students.length ? (
          <div className="tablewrap"><table>
            <thead><tr><th>Student</th><th>Grade</th><th>Placement by subject (level 1–4)</th><th>Last assessed</th><th>Username</th><th></th></tr></thead>
            <tbody>{students.map(s => {
              const l = latest.get(s.id);
              return (
                <tr key={s.id}>
                  <td><Link href={`/students/${s.id}`}>{s.firstName} {s.lastName}</Link></td>
                  <td className="num">{gradeShort(s.grade ?? 0)}</td>
                  <td>{l ? <SubjectChips results={l.results} grade={l.grade} /> : <span className="small muted">{going.has(s.id) ? "Assessment in progress" : "Not assessed yet"}</span>}</td>
                  <td className="small muted num">{l ? fmtStamp(l.completedAt, school.timezone) : "—"}</td>
                  <td className="num small">{s.username}</td>
                  <td><form action={resetPassword}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="returnTo" value={returnTo} /><button className="btn small">New password</button></form></td>
                </tr>
              );
            })}</tbody>
          </table></div>
        ) : <div className="empty">No students in this class yet.</div>}
      </section>

      <section className="stack">
        <div className="spread">
          <div><h2>Attendance</h2><p className="muted small">{fmtLong(date)}{info.schoolDay ? "" : ` · ${info.reason}`}</p></div>
          <div className="row">
            <Link className="btn small" href={`${returnTo}?date=${isoDate(addDays(date, -1))}`}>← Previous day</Link>
            {date < today && <Link className="btn small" href={`${returnTo}?date=${isoDate(addDays(date, 1))}`}>Next day →</Link>}
            {date.getTime() !== today.getTime() && <Link className="btn small" href={returnTo}>Today</Link>}
          </div>
        </div>
        {students.length > 0 && (
          <form action={saveAttendance} className="stack">
            <input type="hidden" name="classId" value={cls.id} />
            <input type="hidden" name="date" value={isoDate(date)} />
            <div className="tablewrap"><table>
              <thead><tr><th>Student</th><th>Status</th><th>Note</th></tr></thead>
              <tbody>{students.map(s => {
                const a = attBy.get(s.id);
                const current = a?.status ?? (info.schoolDay ? "PRESENT" : "");
                return (
                  <tr key={s.id}>
                    <td>{s.firstName} {s.lastName}{!a && info.schoolDay && <span className="small muted"> · not saved yet</span>}</td>
                    <td><div className="att" role="radiogroup" aria-label={`Attendance for ${s.firstName}`}>
                      {OPTIONS.map(([v, label]) => (
                        <label key={v}><input type="radio" name={`status_${s.id}`} value={v} defaultChecked={current === v} /><span>{label}</span></label>
                      ))}
                    </div></td>
                    <td><input aria-label={`Note for ${s.firstName}`} type="text" name={`note_${s.id}`} id={`note-${s.id}`} defaultValue={a?.note ?? ""} placeholder="Optional" /></td>
                  </tr>
                );
              })}</tbody>
            </table></div>
            <div className="row"><button className="btn primary">Save attendance</button>{!info.schoolDay && <span className="small muted">This isn&apos;t a school day on the calendar. Save only if you met anyway.</span>}</div>
          </form>
        )}
      </section>
    </Shell>
  );
}
