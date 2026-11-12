import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canManageStudent, canViewStudent } from "@/lib/access";
import { db } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { Ruler, StatusPill } from "@/components/Status";
import { PlanView, type PlanData } from "@/components/PlanView";
import { latestScored, countStatuses } from "@/lib/records";
import { buildPlan, MODE_LABEL, nextLevelSkills, nextTarget } from "@/lib/plan";
import { type Status, type StoredResult } from "@/lib/assessment";
import { addDays, fmtDate, fmtStamp, isoDate, MONTHS, todayIn, WEEKDAYS } from "@/lib/dates";
import { gradeName, plural } from "@/lib/subjects";
import { SUBJECT_BY_ID, isSubjectId } from "@/lib/subjects";
import { practiceSummary } from "@/lib/practice";
import { learnHref } from "@/lib/links";
import { dayStatuses, streaks, weekRange } from "@/lib/schoolday";
import { effortLabel, moodLabel } from "@/lib/prompts";
import { WeekStrip } from "@/components/DayParts";
import { startAssessment } from "@/app/student/actions";
import { resetPassword, updateStudentGrade } from "@/app/school/actions";

export default async function StudentProfile({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ done?: string }> }) {
  const { id } = await params;
  const { done } = await searchParams;
  const viewer = await requireUser();
  if (!(await canViewStudent(viewer, id))) notFound();
  const student = await db.user.findUnique({
    where: { id },
    include: { school: true, studentIn: { include: { class: { include: { coaches: { include: { coach: true } } } } } }, parents: { include: { parent: true } } },
  });
  if (!student || !student.school) notFound();
  const school = student.school;
  const self = viewer.id === student.id;
  const staff = await canManageStudent(viewer, id);
  const today = todayIn(school.timezone);
  const [scored, history, attendance, reports, practice, recentSets, skills] = await Promise.all([
    latestScored(id),
    db.assessment.findMany({ where: { studentId: id, status: "COMPLETE" }, orderBy: { completedAt: "desc" }, select: { id: true, completedAt: true, grade: true, results: true } }),
    db.attendance.findMany({ where: { studentId: id, date: { gte: addDays(today, -30) } } }),
    db.calendarEvent.findMany({ where: { schoolId: school.id, kind: "REPORT" } }),
    practiceSummary([id], 7).then(m => m.get(id)),
    db.practiceSession.findMany({ where: { studentId: id, completedAt: { not: null } }, orderBy: { completedAt: "desc" }, take: 6 }),
    db.skillProgress.findMany({ where: { studentId: id }, orderBy: { updatedAt: "desc" } }),
  ]);
  const grade = student.grade ?? 0;
  const who = self ? "You" : student.firstName;
  const att = { PRESENT: 0, LATE: 0, ABSENT: 0, EXCUSED: 0 } as Record<string, number>;
  attendance.forEach(a => att[a.status]++);

  let planData: PlanData | null = null;
  if (scored) {
    const g = scored.assessment.grade;
    const p = buildPlan({ grade: g, results: scored.results, today, yearEnd: school.yearEnd, extraMilestones: reports.map(r => ({ date: r.startDate, title: r.title })), skillsAt: scored.skillsAt, mastered: new Set(skills.filter(k => k.state === "MASTERED").map(k => `${k.subject}|${k.skill}`)) });
    const statusOf = Object.fromEntries(scored.results.map(r => [r.sid, r.status]));
    planData = {
      todayLabel: fmtDate(today, { weekday: "long", month: "long", day: "numeric" }),
      weekend: p.today.weekend,
      blocks: p.today.blocks.map(b => ({ min: b.min, title: b.title, mode: b.mode, modeLabel: MODE_LABEL[b.mode], ...b.how })),
      schedule: p.sched.days.map((d, i) => ({ day: WEEKDAYS[i], items: d.map(sid => ({ name: SUBJECT_BY_ID[sid].name(g), status: statusOf[sid] })) })),
      perDay: p.sched.perDay,
      weeks: p.weeks.map(w => ({ label: fmtDate(w.start), title: w.title, detail: w.detail, lines: w.lines.map(l => ({ name: l.name, sessions: l.sessions, picks: l.picks.map(x => ({ ...x, modeLabel: MODE_LABEL[x.mode] })) })) })),
      finalMonth: p.finalMonth,
      traj: p.traj.map(t => ({ name: t.name, steps: t.steps })),
      months: p.yearMonths.map(m => ({ label: `${MONTHS[m.m]} ${m.y}`, ph: m.ph, phaseName: m.phaseName, goal: m.goal, items: m.items, milestones: m.milestones })),
      nextGrade: gradeName(Math.min(g + 1, 13)),
    };
  }
  const c = scored ? countStatuses(scored.results) : null;
  const week = weekRange(today);
  const [weekStatus, streakMap, weekLogs] = await Promise.all([
    dayStatuses(school, [id], week.from, week.to),
    streaks(school, [id]),
    db.dailyLog.findMany({ where: { studentId: id, date: { gte: week.from, lte: week.to } }, orderBy: { date: "asc" } }),
  ]);
  const st = streakMap.get(id) ?? { current: 0, best: 0 };

  return (
    <Shell user={viewer}>
      {done && self && <div className="flash ok">Assessment complete. Here&apos;s where you are and your plan to get ahead.</div>}
      <div className="spread">
        <div>
          <span className="eyebrow">{gradeName(grade)} · {school.name}{student.studentIn.length ? ` · ${student.studentIn.map(s => s.class.name).join(", ")}` : ""}</span>
          <h1>{self ? "My learning plan" : `${student.firstName} ${student.lastName}`}</h1>
          {scored && <p className="muted small" style={{ marginTop: 6 }}>Last assessed {fmtStamp(scored.assessment.completedAt!, school.timezone, { weekday: "long", month: "long", day: "numeric", year: "numeric" })} in {gradeName(scored.assessment.grade)}</p>}
        </div>
        {self && scored && <form action={startAssessment}><input type="hidden" name="fresh" value="1" /><button className="btn">Retake the assessment</button></form>}
      </div>

      {!scored ? (
        <div className="empty"><b>{self ? "You haven't" : `${student.firstName} hasn't`} finished an assessment yet</b>
          {self ? <Link className="btn primary" href="/student">Go to Today</Link> : <span>The plan appears here once it&apos;s done.</span>}</div>
      ) : (
        <>
          <section className="grid3">
            <div className="stat below"><span className="n">{c!.below}</span><span>below grade level</span></div>
            <div className="stat at"><span className="n">{c!.at}</span><span>at grade level</span></div>
            <div className="stat above"><span className="n">{c!.above}</span><span>above grade level</span></div>
          </section>

          <section className="stack">
            <h2>Placement and next-level requirements</h2>
            <div className="tablewrap"><table>
              <thead><tr><th>Subject</th><th>Placement</th><th>Level</th><th>To reach the next level, {who.toLowerCase() === "you" ? "show you can" : `${student.firstName} needs to show`}…</th></tr></thead>
              <tbody>{scored.results.map(r => {
                const req = nextLevelSkills(r, scored.assessment.grade, scored.skillsAt);
                const target = `Show ${gradeName(nextTarget(r))} work`;
                return (
                  <tr key={r.sid}>
                    <td><b>{r.name}</b><br /><span className="small muted num">{r.correct}/{r.total} correct</span></td>
                    <td><Ruler status={r.status} grade={scored.assessment.grade} working={r.working} /></td>
                    <td><StatusPill status={r.status} /><br /><span className="small muted">Level {r.level} · working at {r.working < 0 ? "pre-Kindergarten" : gradeName(r.working)} level</span></td>
                    <td className="small"><span className="muted">Next: {target}</span>
                      <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>{req.slice(0, 4).map(s => <li key={s}>{s}</li>)}</ul>
                      {(staff || viewer.role === "PARENT" || self) && (
                        <details className="items"><summary>See the {r.total} questions</summary>
                          <div className="itemlist">{r.items.map(x => (
                            <div key={x.k} className="item"><span className={x.ok ? "ok" : "no"}>{x.ok ? "✓" : "✗"}</span>
                              <div>{x.d.prompt}<small>{gradeName(x.p)} question · {x.d.skill} · {x.ok ? "Correct" : `Answer: ${x.ans === -1 ? "Not sure yet" : x.d.choices[x.ans as number]} · Correct: ${x.d.choices[0]}`}</small></div>
                            </div>
                          ))}</div>
                        </details>
                      )}
                    </td>
                  </tr>
                );
              })}</tbody>
            </table></div>
          </section>

          {planData && <PlanView plan={planData} />}
        </>
      )}

      <section className="card">
        <div className="spread"><h2>This week</h2><span className="small"><b>{st.current}</b>-day streak · best {st.best}</span></div>
        <WeekStrip days={weekStatus.get(id) ?? []} today={isoDate(today)} since={isoDate(todayIn(school.timezone, student.createdAt))} />
        {weekLogs.filter(l => l.checkedInAt || l.reflectedAt).length > 0 && (
          <div className="tablewrap" style={{ border: 0 }}><table>
            <thead><tr><th>Day</th><th>Feeling</th><th>Goal</th><th>Learned</th><th>Effort</th></tr></thead>
            <tbody>{weekLogs.map(l => (
              <tr key={l.id}>
                <td className="small">{fmtDate(l.date, { weekday: "short", month: "short", day: "numeric" })}</td>
                <td className="small">{moodLabel(l.mood)}</td>
                <td className="small">{l.goal || "—"}</td>
                <td className="small">{l.learned || "—"}{l.question && <><br /><span className="muted">Question: {l.question}</span></>}</td>
                <td className="small">{effortLabel(l.effort)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      <section className="card">
        <div className="spread"><h2>Skills</h2><span className="small muted num">{skills.filter(k => k.state === "MASTERED").length} mastered · {skills.filter(k => k.state !== "MASTERED").length} in progress</span></div>
        {skills.length ? (
          <div className="tablewrap" style={{ border: 0 }}><table>
            <thead><tr><th>Skill</th><th>Subject</th><th>Status</th><th>Checks</th><th>Last check</th></tr></thead>
            <tbody>{skills.slice(0, 20).map(k => (
              <tr key={k.id}>
                <td>{self && k.state !== "MASTERED" ? <Link href={learnHref(k.subject, k.grade, k.skill)}>{k.skill}</Link> : k.skill}<br /><span className="small muted">{gradeName(k.grade)}</span></td>
                <td className="small">{isSubjectId(k.subject) ? SUBJECT_BY_ID[k.subject].name(grade) : k.subject}</td>
                <td>{k.state === "MASTERED" ? <span className="pill above">Mastered</span> : k.attempts >= 3 ? <span className="pill below">Needs help</span> : <span className="pill at">Learning</span>}</td>
                <td className="num small">{k.attempts}</td>
                <td className="num small">{k.lastTotal ? `${k.lastScore}/${k.lastTotal}` : "—"}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <p className="muted small">{self ? "Use the Learn it buttons on your Today screen. Each skill has a short lesson, then a 5-question check." : "No lessons started yet."}</p>}
      </section>

      <section className="card">
        <h2>Practice, last 7 days</h2>
        {practice ? (
          <>
            <p className="num">{practice.sets} set{practice.sets === 1 ? "" : "s"} · {practice.questions} questions · {Math.round((practice.correct / Math.max(1, practice.questions)) * 100)}% correct · about {practice.minutes} minutes</p>
            <div className="chips">{[...practice.bySubject].map(([sid, v]) => (
              <span key={sid} className="chip">{isSubjectId(sid) ? SUBJECT_BY_ID[sid].name(grade) : sid}: {v.correct}/{v.questions}</span>
            ))}</div>
          </>
        ) : <p className="muted small">{self ? "No practice yet this week. Use the Practise now buttons on your Today screen." : "No practice sets completed this week."}</p>}
        {recentSets.length > 0 && (
          <div className="stack" style={{ gap: 4 }}>{recentSets.map(r => (
            <p key={r.id} className="small muted num">{fmtStamp(r.completedAt!, school.timezone, { weekday: "short", month: "short", day: "numeric" })} · {isSubjectId(r.subject) ? SUBJECT_BY_ID[r.subject].name(grade) : r.subject}{r.skill ? ` · ${r.skill}` : ""} · {gradeName(r.grade)} · {r.correct}/{r.total}</p>
          ))}</div>
        )}
      </section>

      <section className="grid2" style={{ alignItems: "start" }}>
        <div className="card">
          <h2>Attendance, last 30 days</h2>
          <p className="num">{att.PRESENT} present · {att.LATE} late · {att.ABSENT} absent · {att.EXCUSED} excused</p>
          {attendance.filter(a => a.status !== "PRESENT").sort((a, b) => +b.date - +a.date).slice(0, 6).map(a => (
            <p key={a.id} className="small muted">{fmtDate(a.date, { weekday: "short", month: "short", day: "numeric" })}: {a.status.toLowerCase()}{a.note ? ` (${a.note})` : ""}</p>
          ))}
        </div>
        <div className="card">
          <h2>Assessment history</h2>
          {history.length ? history.map(h => {
            const r = (h.results ?? []) as StoredResult[];
            const cc = { below: 0, at: 0, above: 0 } as Record<Status, number>;
            r.forEach(x => cc[x.status]++);
            return <p key={h.id} className="small num">{fmtStamp(h.completedAt!, school.timezone, { month: "short", day: "numeric", year: "numeric" })} · {gradeName(h.grade)} · {cc.below} below · {cc.at} at · {cc.above} above</p>;
          }) : <p className="muted small">None yet.</p>}
        </div>
      </section>

      {(staff || viewer.role === "PARENT") && (
        <section className="card">
          <h2>Account and family</h2>
          <p className="small">{student.studentIn.flatMap(s => s.class.coaches).length === 1 ? school.coachTitle : plural(school.coachTitle)}: {[...new Set(student.studentIn.flatMap(s => s.class.coaches.map(c => `${c.coach.firstName} ${c.coach.lastName}`)))].join(", ") || "not assigned yet"}</p>
          <p className="small">Parents: {student.parents.map(p => `${p.parent.firstName} ${p.parent.lastName}`).join(", ") || "none connected"}</p>
          {staff && <>
            <p className="small">Sign-in: school code <b className="num">{school.code}</b>, username <b className="num">{student.username}</b> · Family code for parents: <b className="num">{student.familyCode}</b></p>
            <div className="row">
              <form action={resetPassword}><input type="hidden" name="id" value={student.id} /><input type="hidden" name="returnTo" value={`/students/${student.id}`} /><button className="btn small">Give {student.firstName} a new password</button></form>
              {viewer.role === "SCHOOL_ADMIN" && (
                <form action={updateStudentGrade} className="row" style={{ gap: 6 }}>
                  <input type="hidden" name="id" value={student.id} />
                  <select aria-label="Grade" id="grade" name="grade" defaultValue={grade} style={{ width: "auto" }}>{Array.from({ length: 13 }, (_, g) => <option key={g} value={g}>{gradeName(g)}</option>)}</select>
                  <button className="btn small">Change grade</button>
                </form>
              )}
            </div>
          </>}
        </section>
      )}
    </Shell>
  );
}
