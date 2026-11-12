import Link from "next/link";
import { auditView } from "@/lib/audit";
import { consentFor } from "@/lib/consent";
import { ConsentControls } from "@/components/ConsentControls";
import { deleteStudentPermanently } from "@/app/privacy-actions/actions";
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
import { gradeName } from "@/lib/subjects";
import { SUBJECT_BY_ID, isSubjectId, plural, subjectsForGrade } from "@/lib/subjects";
import { practiceSummary } from "@/lib/practice";
import { learnHref } from "@/lib/links";
import { completion, describe, skillMenu } from "@/lib/assignments";
import { addNote, createAssignment, deleteNote } from "@/app/coach/assign-actions";
import { AssignForm } from "@/components/AssignForm";
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
  await auditView(viewer, id, "student.view");
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
  const isFamily = self || viewer.role === "PARENT";
  const consent = viewer.role === "SCHOOL_ADMIN" ? (await consentFor([id])).get(id) : undefined;
  const [assignments, notes, menu] = await Promise.all([
    db.assignment.findMany({ where: { targets: { some: { studentId: id } } }, include: { targets: true, createdBy: true }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.coachNote.findMany({ where: { studentId: id, ...(isFamily ? { shared: true } : {}) }, include: { author: true }, orderBy: { createdAt: "desc" }, take: 30 }),
    staff ? skillMenu([grade]) : Promise.resolve({}),
  ]);
  const completed = await completion(assignments);
  const subjectOptions = subjectsForGrade(grade).map(x => ({ id: x.id, name: x.name(grade) }));
  const h0 = (r: StoredResult) => grade + (r.level === 4 ? 1 : r.level === 3 ? 0 : r.level === 2 ? -1 : -2);
  const weeklyMastered = Array.from({ length: 6 }, (_, i) => {
    const end = addDays(today, -7 * i + 1), start = addDays(end, -7);
    return skills.filter(k => k.masteredAt && k.masteredAt >= start && k.masteredAt < end).length;
  }).reverse();

  return (
    <Shell user={viewer}>
      {done && self && <div className="flash ok">Assessment complete. Here&apos;s where you are and your plan to get ahead.</div>}
      <div className="spread">
        <div>
          <span className="eyebrow">{gradeName(grade)} · {school.name}{student.studentIn.length ? ` · ${student.studentIn.map(s => s.class.name).join(", ")}` : ""}</span>
          <h1>{self ? "My learning plan" : `${student.firstName} ${student.lastName}`}</h1>
          {scored && <p className="muted small" style={{ marginTop: 6 }}>Last assessed {fmtStamp(scored.assessment.completedAt!, school.timezone, { weekday: "long", month: "long", day: "numeric", year: "numeric" })} in {gradeName(scored.assessment.grade)}</p>}
        </div>
        <div className="row">
          <Link className="btn" href={`/students/${student.id}/portfolio`}>{self ? "My portfolio" : "Portfolio"}</Link>
          <Link className="btn" href={self ? "/student/projects" : `/students/${student.id}/projects`}>{self ? "My projects" : "Projects"}</Link>
          {self && scored && <form action={startAssessment}><input type="hidden" name="fresh" value="1" /><button className="btn">Retake the assessment</button></form>}
        </div>
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
                    <td className="small" style={{ minWidth: 320 }}><span className="muted">Next: {target}</span>
                      <ul style={{ margin: "6px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 6 }}>{req.map(q => {
                        const k = skills.find(x => x.subject === r.sid && x.skill === q.skill);
                        const state = k?.state === "MASTERED" ? "mastered" : k ? (k.attempts >= 3 ? "help" : "learning") : "new";
                        return (
                          <li key={q.skill} className="row" style={{ gap: 8 }}>
                            <span className={`chip ${state === "mastered" ? "above" : state === "help" ? "below" : state === "learning" ? "at" : ""}`}>{state === "mastered" ? "✓ Mastered" : state === "help" ? "Needs help" : state === "learning" ? "Learning" : "Not started"}</span>
                            {self && state !== "mastered" ? <Link href={learnHref(r.sid, q.grade, q.skill)}>{q.skill}</Link> : <span>{q.skill}</span>}
                            <span className="muted small">{gradeName(q.grade)}</span>
                            {staff && state !== "mastered" && (
                              <form action={createAssignment}>
                                <input type="hidden" name="returnTo" value={`/students/${student.id}`} /><input type="hidden" name="kind" value="MASTER_SKILL" />
                                <input type="hidden" name="subject" value={r.sid} /><input type="hidden" name="grade" value={q.grade} />
                                <input type="hidden" name="skill" value={q.skill} /><input type="hidden" name="student" value={student.id} />
                                <button className="btn small">Assign</button>
                              </form>
                            )}
                          </li>
                        );
                      })}</ul>
                      <p className="small muted" style={{ marginTop: 4 }}>{req.filter(q => skills.some(x => x.subject === r.sid && x.skill === q.skill && x.state === "MASTERED")).length} of {req.length} requirements mastered</p>
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

      {(assignments.length > 0 || staff) && (
        <section className="card">
          <h2>Assignments</h2>
          {assignments.length ? (
            <div className="stack" style={{ gap: 6 }}>{assignments.map(a => {
              const doneAt = completed.get(`${a.id}:${student.id}`);
              const overdue = !doneAt && a.dueDate && a.dueDate < today;
              return (
                <div key={a.id} className="row" style={{ gap: 8 }}>
                  <span className={`pill ${doneAt ? "above" : overdue ? "below" : "at"}`}>{doneAt ? "Done" : overdue ? "Overdue" : "To do"}</span>
                  <span>{describe(a)}</span>
                  {a.dueDate && <span className="small muted">due {fmtDate(a.dueDate, { weekday: "short", month: "short", day: "numeric" })}</span>}
                  {a.note && <span className="small muted">“{a.note}”</span>}
                  <span className="small muted">from {a.createdBy.firstName}</span>
                </div>
              );
            })}</div>
          ) : <p className="muted small">No assignments yet.</p>}
          {staff && <AssignForm students={[{ id: student.id, name: student.firstName }]} menu={menu} subjects={subjectOptions} returnTo={`/students/${student.id}`} defaultGrade={grade} />}
        </section>
      )}

      {(staff || notes.length > 0) && (
        <section className="card">
          <h2>{staff ? `Notes from ${plural(school.coachTitle).toLowerCase()}` : `Notes from your ${school.coachTitle.toLowerCase()}`}</h2>
          {notes.length ? notes.map(n => (
            <div key={n.id} className="card tight" style={{ background: "var(--paper)" }}>
              <p style={{ whiteSpace: "pre-wrap" }}>{n.body}</p>
              <div className="spread small muted" style={{ alignItems: "center" }}>
                <span>{n.author.firstName} {n.author.lastName} · {fmtStamp(n.createdAt, school.timezone, { month: "short", day: "numeric", year: "numeric" })}{staff && (n.shared ? " · shared with student and family" : " · staff only")}</span>
                {staff && (n.authorId === viewer.id || viewer.role === "SCHOOL_ADMIN") && <form action={deleteNote}><input type="hidden" name="id" value={n.id} /><button className="btn small">Delete</button></form>}
              </div>
            </div>
          )) : <p className="muted small">No notes yet.</p>}
          {staff && (
            <form action={addNote} className="stack" style={{ gap: 8 }}>
              <input type="hidden" name="studentId" value={student.id} />
              <label className="field">Add a note<textarea id="note-body" name="body" required style={{ fontFamily: "inherit", fontSize: ".95rem", minHeight: 80 }} /></label>
              <label className="check"><input type="checkbox" name="shared" id="note-shared" />Share with {student.firstName} and their family</label>
              <div><button className="btn small primary">Save note</button></div>
            </form>
          )}
        </section>
      )}

      {history.length > 1 && (
        <section className="card">
          <h2>Progress over time</h2>
          <p className="small muted">The grade level each subject was working at, assessment by assessment.</p>
          <div className="tablewrap" style={{ border: 0 }}><table>
            <thead><tr><th>Subject</th>{[...history].reverse().map(h => <th key={h.id} className="num">{fmtStamp(h.completedAt!, school.timezone, { month: "short", day: "numeric" })}</th>)}<th>Change</th></tr></thead>
            <tbody>{[...new Set(history.flatMap(h => ((h.results ?? []) as StoredResult[]).map(r => r.sid)))].map(sid => {
              const series = [...history].reverse().map(h => ((h.results ?? []) as StoredResult[]).find(r => r.sid === sid));
              const lvl = (r?: StoredResult) => r ? (r.working ?? h0(r)) : null;
              const first = lvl(series.find(Boolean)), last = lvl([...series].reverse().find(Boolean));
              const delta = first !== null && last !== null ? last - first : 0;
              return (
                <tr key={sid}>
                  <td className="small"><b>{isSubjectId(sid) ? SUBJECT_BY_ID[sid].name(grade) : sid}</b></td>
                  {series.map((r, i) => <td key={i} className="num small">{r ? <span className={`chip ${r.status}`}>{lvl(r)! < 0 ? "Pre-K" : lvl(r) === 0 ? "K" : `Gr ${lvl(r)}`}</span> : "—"}</td>)}
                  <td className="small">{delta > 0 ? <span className="pill above">+{delta} grade{delta > 1 ? "s" : ""}</span> : delta < 0 ? <span className="pill below">{delta}</span> : <span className="muted">No change</span>}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
          <p className="small">Skills mastered per week (last 6 weeks): {weeklyMastered.map((n, i) => <span key={i} className="chip" style={{ marginRight: 4 }}>{n}</span>)}</p>
        </section>
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
        ) : <p className="muted small">{self ? "No practice yet this week. Use the Practice now buttons on your Today screen." : "No practice sets completed this week."}</p>}
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

      {viewer.role === "SCHOOL_ADMIN" && consent && (
        <section className="card">
          <h2>Privacy and consent</h2>
          <ConsentControls studentId={student.id} state={consent} returnTo={`/students/${student.id}`} recording />
          <p className="small"><a href={`/api/students/${student.id}/export`}>Download all of {student.firstName}&apos;s data (JSON file)</a> · <Link href={`/school/privacy?student=${student.id}`}>Who has viewed or changed these records</Link></p>
          <details className="items"><summary>Permanently delete {student.firstName} and all their data</summary>
            <form action={deleteStudentPermanently} className="stack" style={{ gap: 8, marginTop: 10 }}>
              <input type="hidden" name="studentId" value={student.id} />
              <p className="small">This removes the account, assessments, plans, practice, check-ins, attendance, notes, portfolio, files and projects. It can&apos;t be undone. Download the data first if the family wants a copy.</p>
              <label className="field small">Type “{student.firstName} {student.lastName}” to confirm<input id="confirm-delete" name="confirm" type="text" autoComplete="off" required /></label>
              <div><button className="btn small danger">Delete permanently</button></div>
            </form>
          </details>
        </section>
      )}

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
