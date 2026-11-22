import { Info } from "@/components/Info";
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
import { unitFor } from "@/lib/presumptuous";
import { EntToday } from "@/components/EntToday";
import { dayBounds, dayStatuses, streaks, weekRange } from "@/lib/schoolday";
import { startAssessment } from "./actions";
import { startPractice } from "./practice/actions";
import { PROJECT_LABEL } from "@/lib/projects";
import { weekBoard } from "@/lib/week";
import { StudentCards } from "@/components/StudentCards";

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
  const board = scored ? await weekBoard(user, school, info.date) : null;
  const plan = scored ? buildPlan({ grade: scored.assessment.grade, results: scored.results, today: info.date, yearEnd: school.yearEnd, skillsAt: scored.skillsAt, mastered }) : null;
  const todayLearn = board?.today.filter(t => t.kind === "learn") ?? [];
  // Today's saved lessons; on days with none (weekends, or a week that starts later) the live plan, so there's always something to learn
  const tasks = todayLearn.length ? todayLearn.map(t => ({ sid: t.subject as PlanBlock["sid"], skill: t.skill, grade: t.grade, title: t.eyebrow.split(" · ")[0], mode: (plan?.today.blocks.find(b => b.sid === t.subject && b.skill === t.skill)?.mode ?? "practice") as PlanBlock["mode"], how: { before: "", skill: "", after: "" }, min: 0 } as PlanBlock)) : (plan?.today.blocks.filter(b => b.sid) ?? []);
  const habits = plan?.today.blocks.filter(b => !b.sid) ?? [];
  const didTask = (b: PlanBlock) => todaySessions.some(s => s.subject === b.sid && s.skill === b.skill) || (!!b.skill && mastered.has(`${b.sid}|${b.skill}`));
  const learningDone = todaySessions.length > 0;
  const wd = weekdayIndex(info.date);
  const life = lifePromptFor(info.date, grade, wd);
  const unit = unitFor(info.date);
  const mindful = mindfulnessFor(info.date);
  const st = streak.get(user.id) ?? { current: 0, best: 0 };
  const steps = [
    { label: "Check in", done: !!log?.checkedInAt },
    { label: "Learn", done: learningDone },
    { label: "Arts", done: !!log?.artsDone },
    { label: "Presumptuous", done: !!log?.lifeDone },
    { label: "Reflect", done: !!log?.reflectedAt },
  ];
  const doneCount = steps.filter(s => s.done).length;
  const dayBlocks = blocks.filter(b => b.days.includes(wd)); // blocks can run on some weekdays only
  const kinds = new Set(dayBlocks.map(b => b.kind));

  const answered = inProgress ? (inProgress.answers as (number | null)[]).filter(a => a !== null).length : 0;
  const assessmentCard = inProgress ? (
    <div className="card">
      <h2>Finish your assessment<Info label="Your assessment">{"Your answers are saved as you go, so you can stop and come back. When you finish, you get your own plan for today, this month and this year."}</Info></h2>
      <p className="muted">You&apos;ve answered {answered} questions so far. Pick up where you left off.</p>
      <div><Link className="btn primary" href="/student/assessment">Continue</Link></div>
    </div>
  ) : !scored ? (
    <form action={startAssessment} className="card">
      <h2>Start with your placement assessment<Info label="Placement assessment">{"A few questions in each of your subjects. They get harder when you're right and easier when you're not sure, to find the level that fits you. It isn't a test you pass or fail. Pick \"I'm not sure yet\" instead of guessing."}</Info></h2>
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
      {scored && <Link href="/student/progress" className="small">See my progress</Link>}
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
          <EntToday unit={unit} grade={grade} mastered={mastered} projectTitle={myProjects.find(p => p.type === "LIFE_SKILLS")?.title} />
          <PromptTask kind="life" label={`Warm-up · ${life.track}`} prompt={life.prompt} done={!!log?.lifeDone} />
          <div className="stack" style={{ gap: 4, marginTop: 8 }}>
            {myProjects.length ? myProjects.map(pr => {
              const nx = pr.milestones.find(m => m.status !== "APPROVED");
              return <p key={pr.id} className="small"><b>{PROJECT_LABEL[pr.type]}:</b> {nx ? <>next step <Link href={`/student/projects/${pr.id}`}>{nx.title}</Link>, due {fmtDate(nx.dueDate, { month: "short", day: "numeric" })}{nx.status === "NEEDS_WORK" && <> <span className="pill below">Needs work</span></>}</> : "all steps approved"}</p>;
            }) : <p className="small"><Link href="/student/projects">Start your Presumptuous and Purpose projects</Link></p>}
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

      {board && <StudentCards board={board} schoolDay={info.schoolDay} reason={info.reason} checkedIn={!!log?.checkedInAt} reflected={!!log?.reflectedAt} hasAssembly={kinds.has("ASSEMBLY")} hasReflection={kinds.has("REFLECTION")} coachTitle={school.coachTitle} />}

      {info.schoolDay ? (
        <section className="card">
          <div className="spread" style={{ alignItems: "center" }}>
            <h2>Today: {doneCount} of {steps.length} done<Info label="Your day">{"Five things make a full school day: check in, learn (a lesson or practice set), arts, life skills, and reflect. Check in, learn and reflect on every school day to grow your streak. The boxes show this week: green means you finished that day."}</Info></h2>
            <span className="small muted">Check in, learn and reflect to keep your streak.</span>
          </div>
          <div className="progress" role="progressbar" aria-label="Today's progress" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={doneCount}><i style={{ width: `${(doneCount / steps.length) * 100}%` }} /></div>
          <div className="chips">{steps.map(s => <span key={s.label} className={`chip ${s.done ? "above" : ""}`}>{s.done ? "✓ " : ""}{s.label}</span>)}</div>
          <WeekStrip days={weekStatus.get(user.id) ?? []} today={isoDate(info.date)} since={isoDate(todayIn(school.timezone, user.createdAt))} />
        </section>
      ) : (
        <div className="flash ok"><span>No school today ({info.reason}). You can still learn and practice below.</span></div>
      )}

      {info.schoolDay && !kinds.has("ASSEMBLY") && <section className="card" id="block-ASSEMBLY"><h2>Morning check-in<Info label="Check-in">{"Tell us how you feel and set one goal for today. Your coach sees how the class is feeling."}</Info></h2><CheckIn log={log} mindful={mindful} /></section>}

      <section className="card">
        <div className="spread"><h2>{info.schoolDay ? "Your school day" : "Your learning plan"}<Info label="Your school day">{"This follows your school's real timetable. Each block shows what to do in it. In Core Academics, \"Learn it\" opens a lesson and then a 5-question check; \"Practice now\" gives you 5 questions with answers shown right away. Labels: Stretch = work from the next grade up, Secure = practice at your grade, Repair = catch up on an earlier skill."}</Info></h2></div>
        {info.events.filter(e => !e.noSchool).map(e => <p key={e.id} className="small"><b>Today:</b> {e.title}</p>)}
        {info.schoolDay && dayBlocks.length ? (
          <div className="day">{dayBlocks.map(b => {
            const isNow = now >= b.start && now < b.end;
            const isNext = !isNow && now < b.start && !dayBlocks.some(x => x.start < b.start && x.start > now);
            return (
              <div key={b.id} className={`blockrow ${isNow ? "now" : ""}`} id={`block-${b.kind}`}>
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

      {info.schoolDay && !kinds.has("ACADEMICS") && <section className="card"><h2>Learn<Info label="Learn">{"Skills from your plan. \"Learn it\" teaches the skill and then checks it with 5 questions (get 4 right to master it). \"Practice now\" is 5 questions with answers shown right away."}</Info></h2>{learnList}</section>}
      {info.schoolDay && !kinds.has("REFLECTION") && <section className="card" id="block-REFLECTION"><h2>End-of-day reflection<Info label="Reflection">{"One thing you learned, a question you still have, and how hard you pushed. Saving it finishes your day for your streak."}</Info></h2><Reflect log={log} /></section>}
    </Shell>
  );
}
