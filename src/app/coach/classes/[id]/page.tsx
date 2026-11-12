import { Info } from "@/components/Info";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSchoolUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { SubjectChips } from "@/components/Status";
import { dayInfo, latestResults } from "@/lib/records";
import { practiceSummary } from "@/lib/practice";
import { completion, describe, skillMenu } from "@/lib/assignments";
import { deleteAssignment } from "@/app/coach/assign-actions";
import { AssignForm } from "@/components/AssignForm";
import { dayStatuses, streaks } from "@/lib/schoolday";
import { moodLabel } from "@/lib/prompts";
import { addDays, fmtDate, fmtLong, fmtStamp, isoDate, parseIsoDate, todayIn } from "@/lib/dates";
import { gradeShort, plural, subjectsForGrade } from "@/lib/subjects";
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
  const [latest, att, inProgress, practice, skillRows] = await Promise.all([
    latestResults(ids),
    db.attendance.findMany({ where: { studentId: { in: ids }, date } }),
    db.assessment.findMany({ where: { studentId: { in: ids }, status: "IN_PROGRESS" }, select: { studentId: true } }),
    practiceSummary(ids, 7),
    db.skillProgress.findMany({ where: { studentId: { in: ids } }, select: { studentId: true, state: true, attempts: true, skill: true } }),
  ]);
  const skillsOf = (sid: string) => skillRows.filter(k => k.studentId === sid);
  const attBy = new Map(att.map(a => [a.studentId, a]));
  const going = new Set(inProgress.map(a => a.studentId));
  const returnTo = `/coach/classes/${cls.id}`;
  const [todayStatus, logs, streakMap] = await Promise.all([
    dayStatuses(school, ids, today, today),
    db.dailyLog.findMany({ where: { studentId: { in: ids }, date: today } }),
    streaks(school, ids),
  ]);
  const logOf = new Map(logs.map(l => [l.studentId, l]));
  const [classAssignments, menu] = await Promise.all([
    db.assignment.findMany({ where: { schoolId: school.id, targets: { some: { studentId: { in: ids } } } }, include: { targets: true, createdBy: true }, orderBy: { createdAt: "desc" }, take: 30 }),
    skillMenu(cls.grades.length ? cls.grades : students.map(s => s.grade ?? 0).concat([0]).slice(0, 13)),
  ]);
  const done = await completion(classAssignments);
  const classGrade = cls.grades.length ? Math.min(...cls.grades) : (students[0]?.grade ?? 0);
  const subjectOptions = subjectsForGrade(Math.max(...(cls.grades.length ? cls.grades : [classGrade]))).map(x => ({ id: x.id, name: x.name(classGrade) }));
  const lowMood = logs.filter(l => (l.mood ?? 5) <= 2);

  return (
    <Shell user={user}>
      <div className="spread">
        <div>
          <Link href={user.role === "COACH" ? "/coach" : "/school/classes"} className="small">← {user.role === "COACH" ? "My classes" : "Classes"}</Link>
          <h1>{cls.name}</h1>
          <p className="small" style={{ margin: "4px 0" }}><Link href={`/coach/classes/${cls.id}/studio`}>Class studio: students&apos; work and your feedback →</Link> · <Link href={`/coach/classes/${cls.id}/projects`}>Class projects: review steps →</Link></p>
          <p className="muted small">{plural(school.coachTitle)}: {cls.coaches.map(c => `${c.coach.firstName} ${c.coach.lastName}`).join(", ") || "none"} · Students sign in with school code <b className="num">{school.code}</b></p>
        </div>
      </div>

      {date.getTime() === today.getTime() && info.schoolDay && students.length > 0 && (
        <section className="stack">
          <div className="spread"><h2>Today in class<Info label="Today in class">{"Who has checked in, how they feel, what they've learned today and whether they reflected. Updates as students work."}</Info></h2>
            <span className="small muted">{logs.filter(l => l.checkedInAt).length} of {students.length} checked in · {logs.filter(l => l.reflectedAt).length} reflected</span></div>
          {lowMood.length > 0 && (
            <div className="flash error"><span>{lowMood.length === 1 ? "1 student" : `${lowMood.length} students`} checked in feeling Low or Rough: {lowMood.map(l => students.find(s => s.id === l.studentId)?.firstName).filter(Boolean).join(", ")}. A quick check-in from you may help.</span></div>
          )}
          <div className="tablewrap"><table>
            <thead><tr><th>Student</th><th>Feeling</th><th>Goal</th><th>Learning today</th><th>Arts · Life</th><th>Reflection</th><th>Streak</th></tr></thead>
            <tbody>{students.map(s => {
              const l = logOf.get(s.id); const d = todayStatus.get(s.id)?.[0];
              return (
                <tr key={s.id}>
                  <td><Link href={`/students/${s.id}`}>{s.firstName} {s.lastName}</Link></td>
                  <td>{l?.checkedInAt ? <span className={`pill ${(l.mood ?? 3) <= 2 ? "below" : (l.mood ?? 3) >= 4 ? "above" : "at"}`}>{moodLabel(l.mood)}</span> : <span className="small muted">Not yet</span>}</td>
                  <td className="small">{l?.goal || <span className="muted">—</span>}</td>
                  <td className="small num">{d?.learning ? `${d.learning} activit${d.learning === 1 ? "y" : "ies"}` : <span className="muted">None yet</span>}</td>
                  <td className="small">{l?.artsDone ? "✓" : "·"} {l?.lifeDone ? "✓" : "·"}</td>
                  <td className="small">{l?.reflectedAt ? <span title={l.learned}>✓ {l.learned.slice(0, 40)}{l.learned.length > 40 ? "…" : ""}</span> : <span className="muted">Not yet</span>}</td>
                  <td className="num small">{streakMap.get(s.id)?.current ?? 0}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        </section>
      )}

      <section className="stack">
        <h2>Assignments<Info label="Assignments">{"Set a skill to master, a practice set, or a retake of the assessment for one student or the whole class. It shows on the student's Today page and ticks off by itself when they finish."}</Info></h2>
        {classAssignments.length ? (
          <div className="tablewrap"><table>
            <thead><tr><th>Assignment</th><th>Due</th><th>Done</th><th>Still to do</th><th></th></tr></thead>
            <tbody>{classAssignments.map(a => {
              const inClass = a.targets.filter(t => ids.includes(t.studentId));
              const finished = inClass.filter(t => done.has(`${a.id}:${t.studentId}`));
              const waiting = inClass.filter(t => !done.has(`${a.id}:${t.studentId}`));
              const overdue = a.dueDate && a.dueDate < today && waiting.length > 0;
              return (
                <tr key={a.id}>
                  <td>{describe(a)}{a.note && <><br /><span className="small muted">“{a.note}”</span></>}<br /><span className="small muted">by {a.createdBy.firstName}</span></td>
                  <td className="small">{a.dueDate ? <span className={overdue ? "pill below" : ""}>{fmtDate(a.dueDate, { month: "short", day: "numeric" })}</span> : "—"}</td>
                  <td className="num">{finished.length}/{inClass.length}</td>
                  <td className="small">{waiting.map(t => students.find(x => x.id === t.studentId)?.firstName).filter(Boolean).join(", ") || <span className="pill above">Everyone</span>}</td>
                  <td><form action={deleteAssignment}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="returnTo" value={returnTo} /><button className="btn small">Remove</button></form></td>
                </tr>
              );
            })}</tbody>
          </table></div>
        ) : <p className="muted small">No assignments yet. Assign a skill to master, practice, or an assessment retake below, or use the Assign buttons on a student&apos;s next-level requirements.</p>}
        {students.length > 0 && <AssignForm students={students.map(s => ({ id: s.id, name: `${s.firstName} ${s.lastName}` }))} menu={menu} subjects={subjectOptions} returnTo={returnTo} defaultGrade={classGrade} />}
      </section>

      <section className="stack">
        <h2>Where each student is<Info label="Where each student is">{"Each student's placement by subject (red below, yellow at, green above grade level), streak and practice. Click a name for the full plan, notes and next-level skills."}</Info></h2>
        {students.length ? (
          <div className="tablewrap"><table>
            <thead><tr><th>Student</th><th>Grade</th><th>Placement by subject (level 1–4)</th><th>Last assessed</th><th>Skills</th><th>Practice (7 days)</th><th>Username</th><th></th></tr></thead>
            <tbody>{students.map(s => {
              const l = latest.get(s.id);
              return (
                <tr key={s.id}>
                  <td><Link href={`/students/${s.id}`}>{s.firstName} {s.lastName}</Link></td>
                  <td className="num">{gradeShort(s.grade ?? 0)}</td>
                  <td>{l ? <SubjectChips results={l.results} grade={l.grade} /> : <span className="small muted">{going.has(s.id) ? "Assessment in progress" : "Not assessed yet"}</span>}</td>
                  <td className="small muted num">{l ? fmtStamp(l.completedAt, school.timezone) : "—"}</td>
                  <td className="small">{(() => {
                    const k = skillsOf(s.id); const stuck = k.filter(x => x.state !== "MASTERED" && x.attempts >= 3);
                    return <>{k.filter(x => x.state === "MASTERED").length} mastered · {k.filter(x => x.state !== "MASTERED").length} learning{stuck.length > 0 && <><br /><span className="pill below" title={stuck.map(x => x.skill).join(", ")}>Needs help: {stuck.map(x => x.skill).slice(0, 2).join(", ")}</span></>}</>;
                  })()}</td>
                  <td className="small num">{(() => { const p = practice.get(s.id); return p ? `${p.sets} sets · ${Math.round((p.correct / Math.max(1, p.questions)) * 100)}%` : <span className="muted">None</span>; })()}</td>
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
          <div><h2>Attendance<Info label="Attendance">{"Mark each student present, late or absent for the day shown and save. Parents and the school admin see attendance."}</Info></h2><p className="muted small">{fmtLong(date)}{info.schoolDay ? "" : ` · ${info.reason}`}</p></div>
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
