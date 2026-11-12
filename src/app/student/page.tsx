import Link from "next/link";
import { requireSchoolUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { dayInfo, latestScored } from "@/lib/records";
import { buildPlan, MODE_LABEL } from "@/lib/plan";
import { clockIn, fmtClock, fmtLong } from "@/lib/dates";
import { gradeName, subjectsForGrade } from "@/lib/subjects";
import { BLOCK_KIND_LABEL, type BlockKindName } from "@/lib/templates";
import { startAssessment } from "./actions";

export const metadata = { title: "Today" };

export default async function StudentToday() {
  const { user, school } = await requireSchoolUser(["STUDENT"]);
  const grade = user.grade ?? 0;
  const [info, blocks, scored, inProgress] = await Promise.all([
    dayInfo(school),
    db.scheduleBlock.findMany({ where: { schoolId: school.id }, orderBy: { position: "asc" } }),
    latestScored(user.id),
    db.assessment.findFirst({ where: { studentId: user.id, status: "IN_PROGRESS" }, select: { answers: true } }),
  ]);
  const now = clockIn(school.timezone);
  const plan = scored ? buildPlan({ grade: scored.assessment.grade, results: scored.results, today: info.date, yearEnd: school.yearEnd }) : null;
  const subjectBlocks = plan?.today.blocks.filter(b => b.sid) ?? [];
  const answered = inProgress ? (inProgress.answers as (number | null)[]).filter(a => a !== null).length : 0;
  const total = inProgress ? (inProgress.answers as unknown[]).length : 0;

  const assessmentCard = inProgress ? (
    <div className="card">
      <h2>Finish your assessment</h2>
      <p className="muted">You&apos;ve answered {answered} of {total} questions. Pick up where you left off.</p>
      <div><Link className="btn primary" href="/student/assessment">Continue</Link></div>
    </div>
  ) : !scored ? (
    <form action={startAssessment} className="card">
      <h2>Start with your placement assessment</h2>
      <p className="muted">About 7 questions in each of your {subjectsForGrade(grade).length} {gradeName(grade)} subjects. Choose “I&apos;m not sure yet” instead of guessing. You can stop and come back any time.</p>
      <div><button className="btn primary">Start the assessment</button></div>
    </form>
  ) : null;

  return (
    <Shell user={user}>
      <div className="spread">
        <div><span className="eyebrow">{gradeName(grade)} · {school.name}</span><h1>Hi {user.firstName}. Let&apos;s overreach today.</h1></div>
        <span className="muted">{fmtLong(info.date)}</span>
      </div>

      {assessmentCard}

      <div className="grid2" style={{ alignItems: "start" }}>
        <section className="card">
          <div className="spread"><h2>Your school day</h2>{!info.schoolDay && <span className="pill none">{info.reason}</span>}</div>
          {info.events.filter(e => !e.noSchool).map(e => <p key={e.id} className="small"><b>Today:</b> {e.title}</p>)}
          {blocks.length ? (
            <div className="day">{blocks.map(b => {
              const isNow = info.schoolDay && now >= b.start && now < b.end;
              const isAcademics = b.kind === "ACADEMICS";
              return (
                <div key={b.id} className={`blockrow ${isNow ? "now" : ""}`}>
                  <div className="t"><b>{fmtClock(b.start)}</b>{fmtClock(b.end)}</div>
                  <div>
                    <span className="kind">{isNow ? "Now · " : ""}{BLOCK_KIND_LABEL[b.kind as BlockKindName]}</span>
                    <h3>{b.title}</h3>
                    {b.focus && <p className="small muted">{b.focus}</p>}
                    {isAcademics && info.schoolDay && subjectBlocks.length > 0 && (
                      <ul className="small" style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                        {subjectBlocks.map((s, i) => <li key={i}>{s.title} <span className={`mode ${s.mode}`}>{MODE_LABEL[s.mode]}</span></li>)}
                      </ul>
                    )}
                  </div>
                </div>
              );
            })}</div>
          ) : <p className="muted">Your school hasn&apos;t set its timetable yet.</p>}
        </section>

        <section className="card">
          <div className="spread"><h2>{plan?.today.weekend ? "This weekend" : "Your learning plan today"}</h2>{scored && <Link href={`/students/${user.id}`} className="small">Full plan</Link>}</div>
          {plan ? (
            <div className="day">{(plan.today.blocks).map((b, i) => (
              <div key={i} className="blockrow">
                <div className="t"><b>{b.min} min</b></div>
                <div>
                  <h3 style={{ fontSize: "1rem" }}>{b.title} <span className={`mode ${b.mode}`}>{MODE_LABEL[b.mode]}</span></h3>
                  <p className="small muted">{b.how.before}{b.how.skill && <b>{b.how.skill}</b>}{b.how.after}</p>
                </div>
              </div>
            ))}</div>
          ) : <p className="muted">Your plan appears here after your assessment.</p>}
        </section>
      </div>
    </Shell>
  );
}
