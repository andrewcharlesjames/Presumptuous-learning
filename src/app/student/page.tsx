import Link from "next/link";
import { requireSchoolUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { CheckIn, PromptTask, Reflect, WeekStrip } from "@/components/DayParts";
import { dayInfo, latestScored, masteredSet } from "@/lib/records";
import { learnHref } from "@/lib/links";
import { buildPlan, MODE_LABEL, type PlanBlock } from "@/lib/plan";
import { clockIn, fmtClock, fmtDate, fmtLong, isoDate, schoolYearOf, weekdayIndex, todayIn } from "@/lib/dates";
import { gradeName, subjectsForGrade } from "@/lib/subjects";
import { BLOCK_KIND_LABEL, type BlockKindName } from "@/lib/templates";
import { artsPromptFor, lifePromptFor, mindfulnessFor } from "@/lib/prompts";
import { dayBounds, dayStatuses, streaks, weekRange } from "@/lib/schoolday";
import { startAssessment } from "./actions";
import { startPractice } from "./practice/actions";
import { completion, describe } from "@/lib/assignments";
import { PROJECT_LABEL } from "@/lib/projects";

export const metadata = { title: "Today" };

export default async function StudentToday() {
  const { user, school } = await requireSchoolUser(["STUDENT"]);
  const grade = user.grade ?? 0;
  const info = await dayInfo(school);
  const { start, end } = dayBounds(info.date, school.timezone);
  const week = weekRange(info.date);
  const [blocks, scored, inProgress, log, todaySessions, mastered, weekStatus, streak] = await Promise.all([
    db.scheduleBlock.findMany({ where: { schoolId: school.id }, orderBy: { position: "asc" } }),
    latestScored(user.id),
    db.assessment.findFirst({ where: { studentId: user.id, status: "IN_PROGRESS" }, select: { answers: true } }),
    db.dailyLog.findUnique({ where: { studentId_date: { studentId: user.id, date: info.date } } }),
    db.practiceSession.findMany({ where: { studentId: user.id, completedAt: { gte: start, lt: end } }, select: { subject: true, skill: true, kind: true } }),
    masteredSet(user.id),
    dayStatuses(school, [user.id], week.from, week.to),
    streaks(school, [user.id]),
  ]);
  const now = clockIn(school.timezone);
  const myProjects = await db.project.findMany({ where: { studentId: user.id, schoolYear: schoolYearOf(info.date) }, include: { milestones: { orderBy: { position: "asc" } } } });
  const myAssignments = await db.assignment.findMany({ where: { targets: { some: { studentId: user.id } } }, include: { targets: { where: { studentId: user.id } }, createdBy: true }, orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }], take: 20 });
  const finishedA = await completion(myAssignments);
  const openA = myAssignments.filter(a => !finishedA.has(`${a.id}:${user.id}`));
  const recentDone = myAssignments.filter(a => { const d = finishedA.get(`${a.id}:${user.id}`); return d && d >= start; });
  const plan = scored ? buildPlan({ grade: scored.assessment.grade, results: scored.results, today: info.date, yearEnd: school.yearEnd, skillsAt: scored.skillsAt, mastered }) : null;
  const tasks = plan?.today.blocks.filter(b => b.sid) ?? [];
  const habits = plan?.today.blocks.filter(b => !b.sid) ?? [];
  const didTask = (b: PlanBlock) => todaySessions.some(s => s.subject === b.sid && s.skill === b.skill) || (!!b.skill && mastered.has(`${b.sid}|${b.skill}`));
  const learningDone = todaySessions.length > 0;
  const wd = weekdayIndex(info.date);
  const life = lifePromptFor(info.date, grade, wd);
  const mindful = mindfulnessFor(info.date);
  const st = streak.get(user.id) ?? { current: 0, best: 0 };
  const steps = [
    { label: "Check in", done: !!log?.checkedInAt },
    { label: "Learn", done: learningDone },
    { label: "Arts", done: !!log?.artsDone },
    { label: "Life skills", done: !!log?.lifeDone },
    { label: "Reflect", done: !!log?.reflectedAt },
  ];
  const doneCount = steps.filter(s => s.done).length;
  const kinds = new Set(blocks.map(b => b.kind));

  const answered = inProgress ? (inProgress.answers as (number | null)[]).filter(a => a !== null).length : 0;
  const assessmentCard = inProgress ? (
    <div className="card">
      <h2>Finish your assessment</h2>
      <p className="muted">You&apos;ve answered {answered} questions so far. Pick up where you left off.</p>
      <div><Link className="btn primary" href="/student/assessment">Continue</Link></div>
    </div>
  ) : !scored ? (
    <form action={startAssessment} className="card">
      <h2>Start with your placement assessment</h2>
      <p className="muted">Questions in each of your {subjectsForGrade(grade).length} {gradeName(grade)} subjects. They get harder when you&apos;re right and easier when you&apos;re not sure, to find your level. You can stop and come back any time.</p>
      <div><button className="btn primary">Start the assessment</button></div>
    </form>
  ) : null;

  const learnList = (
    <div className="stack" style={{ gap: 10, marginTop: 6 }}>
      {tasks.length ? tasks.map((b, i) => (
        <div key={i} className="card tight" style={{ background: "var(--paper)" }}>
          <div className="spread" style={{ alignItems: "center" }}>
            <h4 style={{ margin: 0, fontSize: ".98rem" }}>{b.title} <span className={`mode ${b.mode}`}>{MODE_LABEL[b.mode]}</span></h4>
            {didTask(b) && <span className="pill above">Done today</span>}
          </div>
          {b.sid && b.skill && !b.skill.startsWith("an independent") ? (
            <div className="row" style={{ gap: 8 }}>
              <Link className="btn small primary" href={learnHref(b.sid, b.grade ?? grade, b.skill)}>Learn it</Link>
              <form action={startPractice}>
                <input type="hidden" name="subject" value={b.sid} /><input type="hidden" name="skill" value={b.skill} /><input type="hidden" name="grade" value={b.grade ?? grade} />
                <button className="btn small">Practice now</button>
              </form>
            </div>
          ) : <p className="small muted">{b.how.before}{b.how.skill && <b>{b.how.skill}</b>}{b.how.after}</p>}
        </div>
      )) : <p className="small muted">{scored ? "Every skill on your plan is mastered. Retake the assessment to set new goals." : "Your learning plan appears here after your assessment."}</p>}
      {habits.length > 0 && <p className="small muted">Also today: {habits.map(h => `${h.title} (${h.min} min)`).join(" · ")}</p>}
      {scored && <Link href={`/students/${user.id}`} className="small">See my full plan</Link>}
    </div>
  );

  const blockContent = (kind: string) => {
    if (!info.schoolDay) return null;
    switch (kind) {
      case "ASSEMBLY": return <CheckIn log={log} mindful={mindful} />;
      case "ACADEMICS": return learnList;
      case "ARTS": return <PromptTask kind="arts" label="Today's creative prompt" prompt={artsPromptFor(info.date, grade)} done={!!log?.artsDone} studioHref="/student/studio" />;
      case "LIFE_SKILLS": return (
        <>
          <PromptTask kind="life" label={life.track} prompt={life.prompt} done={!!log?.lifeDone} />
          <div className="stack" style={{ gap: 4, marginTop: 8 }}>
            {myProjects.length ? myProjects.map(pr => {
              const nx = pr.milestones.find(m => m.status !== "APPROVED");
              return <p key={pr.id} className="small"><b>{PROJECT_LABEL[pr.type]}:</b> {nx ? <>next step <Link href={`/student/projects/${pr.id}`}>{nx.title}</Link>, due {fmtDate(nx.dueDate, { month: "short", day: "numeric" })}{nx.status === "NEEDS_WORK" && <> <span className="pill below">Needs work</span></>}</> : "all steps approved"}</p>;
            }) : <p className="small"><Link href="/student/projects">Start your Life Skills and Purpose projects</Link></p>}
          </div>
        </>
      );
      case "REFLECTION": return <Reflect log={log} />;
      default: return null;
    }
  };

  return (
    <Shell user={user}>
      <div className="spread">
        <div><span className="eyebrow">{gradeName(grade)} · {school.name}</span><h1>Hi {user.firstName}. Let&apos;s overreach today.</h1></div>
        <div style={{ textAlign: "right" }}>
          <span className="muted">{fmtLong(info.date)}</span><br />
          <span className="small"><b>{st.current}</b>-day streak{st.best > st.current ? ` · best ${st.best}` : ""}</span>
        </div>
      </div>

      {assessmentCard}

      {(openA.length > 0 || recentDone.length > 0) && (
        <section className="card" style={{ borderColor: "var(--accent)" }}>
          <div className="spread"><h2>From your {school.coachTitle.toLowerCase()}</h2><span className="small muted">{openA.length} to do</span></div>
          {openA.map(a => {
            const overdue = a.dueDate && a.dueDate < info.date;
            return (
              <div key={a.id} className="card tight" style={{ background: "var(--paper)" }}>
                <div className="spread" style={{ alignItems: "center" }}>
                  <b>{describe(a)}</b>
                  {a.dueDate && <span className={`pill ${overdue ? "below" : "at"}`}>{overdue ? "Overdue · " : "Due "}{fmtDate(a.dueDate, { weekday: "short", month: "short", day: "numeric" })}</span>}
                </div>
                {a.note && <p className="small">“{a.note}” — {a.createdBy.firstName}</p>}
                <div className="row" style={{ gap: 8 }}>
                  {a.kind === "ASSESSMENT" ? (
                    <form action={startAssessment}><input type="hidden" name="fresh" value="1" /><button className="btn small primary">Start the assessment</button></form>
                  ) : a.kind === "MASTER_SKILL" ? (
                    <Link className="btn small primary" href={learnHref(a.subject, a.grade, a.skill)}>Learn it</Link>
                  ) : (
                    <form action={startPractice}><input type="hidden" name="subject" value={a.subject} /><input type="hidden" name="skill" value={a.skill} /><input type="hidden" name="grade" value={a.grade} /><button className="btn small primary">Practice now</button></form>
                  )}
                </div>
              </div>
            );
          })}
          {recentDone.map(a => <p key={a.id} className="small"><span className="pill above">Done</span> {describe(a)}</p>)}
        </section>
      )}

      {info.schoolDay ? (
        <section className="card">
          <div className="spread" style={{ alignItems: "center" }}>
            <h2>Today: {doneCount} of {steps.length} done</h2>
            <span className="small muted">Check in, learn and reflect to keep your streak.</span>
          </div>
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={doneCount}><i style={{ width: `${(doneCount / steps.length) * 100}%` }} /></div>
          <div className="chips">{steps.map(s => <span key={s.label} className={`chip ${s.done ? "above" : ""}`}>{s.done ? "✓ " : ""}{s.label}</span>)}</div>
          <WeekStrip days={weekStatus.get(user.id) ?? []} today={isoDate(info.date)} since={isoDate(todayIn(school.timezone, user.createdAt))} />
        </section>
      ) : (
        <div className="flash ok"><span>No school today ({info.reason}). You can still learn and practice below.</span></div>
      )}

      {info.schoolDay && !kinds.has("ASSEMBLY") && <section className="card"><h2>Morning check-in</h2><CheckIn log={log} mindful={mindful} /></section>}

      <section className="card">
        <div className="spread"><h2>{info.schoolDay ? "Your school day" : "Your learning plan"}</h2></div>
        {info.events.filter(e => !e.noSchool).map(e => <p key={e.id} className="small"><b>Today:</b> {e.title}</p>)}
        {info.schoolDay && blocks.length ? (
          <div className="day">{blocks.map(b => {
            const isNow = now >= b.start && now < b.end;
            const isNext = !isNow && now < b.start && !blocks.some(x => x.start < b.start && x.start > now);
            return (
              <div key={b.id} className={`blockrow ${isNow ? "now" : ""}`} id={isNow ? "now" : undefined}>
                <div className="t"><b>{fmtClock(b.start)}</b>{fmtClock(b.end)}</div>
                <div>
                  <span className="kind">{isNow ? "Now · " : isNext ? "Up next · " : ""}{BLOCK_KIND_LABEL[b.kind as BlockKindName]}</span>
                  <h3>{b.title}</h3>
                  {b.focus && <p className="small muted">{b.focus}</p>}
                  {blockContent(b.kind)}
                </div>
              </div>
            );
          })}</div>
        ) : learnList}
      </section>

      {info.schoolDay && !kinds.has("ACADEMICS") && <section className="card"><h2>Learn</h2>{learnList}</section>}
      {info.schoolDay && !kinds.has("REFLECTION") && <section className="card"><h2>End-of-day reflection</h2><Reflect log={log} /></section>}
    </Shell>
  );
}
