import Link from "next/link";
import { requireSchoolUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { Info } from "@/components/Info";
import { Ruler, StatusPill } from "@/components/Status";
import { latestScored, masteredSet } from "@/lib/records";
import { buildPlan, nextLevelSkills, nextTarget } from "@/lib/plan";
import { gradeName } from "@/lib/subjects";
import { fmtDate, todayIn } from "@/lib/dates";
import { checkupDay } from "@/lib/checkup";
import { ENT, ENT_NAME, UNITS, skillsOf, unitFor } from "@/lib/presumptuous";
import { startAssessment } from "../actions";

export const metadata = { title: "My progress" };
const ST: Record<string, string> = { below: "Below", at: "At", above: "Above" };

/** A student's own progress: where each subject is, what levels it up, and when the next check-up is. No work happens here. */
export default async function MyProgress({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const { user, school } = await requireSchoolUser(["STUDENT"]);
  const done = (await searchParams).done === "1";
  const today = todayIn(school.timezone);
  const [scored, mastered, progressRows, report] = await Promise.all([
    latestScored(user.id), masteredSet(user.id),
    db.skillProgress.findMany({ where: { studentId: user.id }, select: { subject: true, skill: true, state: true, attempts: true } }),
    db.reportCard.findFirst({ where: { studentId: user.id, status: "FINAL" }, select: { id: true } }),
  ]);
  const grade = user.grade ?? 0;
  const stateOf = (sid: string, skill: string) => {
    const k = progressRows.find(x => x.subject === sid && x.skill === skill);
    return k?.state === "MASTERED" ? "mastered" : k ? (k.attempts >= 3 ? "help" : "learning") : "new";
  };
  let next = await checkupDay(school, today.getUTCFullYear(), today.getUTCMonth());
  if (!next || next < today.toISOString().slice(0, 10)) next = await checkupDay(school, today.getUTCFullYear() + (today.getUTCMonth() === 11 ? 1 : 0), (today.getUTCMonth() + 1) % 12);

  if (!scored) return (
    <Shell user={user}>
      <h1>My progress</h1>
      <form action={startAssessment} className="hero-card">
        <span className="eyebrow">Start here</span>
        <h2>Take your placement assessment</h2>
        <p>It finds the level you work at in each subject. Then this page shows your progress.</p>
        <div><button className="btn primary">Start the assessment</button></div>
      </form>
    </Shell>
  );

  const plan = buildPlan({ grade: scored.assessment.grade, results: scored.results, today, yearEnd: school.yearEnd, skillsAt: scored.skillsAt, mastered });
  const counts = { below: 0, at: 0, above: 0 } as Record<string, number>;
  scored.results.forEach(r => counts[r.status]++);
  const entAll = UNITS.flatMap(u => skillsOf(u, grade));
  const entDone = entAll.filter(s => mastered.has(`${ENT}|${s.skill}`)).length;
  const unit = unitFor(today);

  return (
    <Shell user={user}>
      {done && <div className="flash ok"><span>Assessment complete. Here&apos;s where you are. Your lessons start on Today.</span></div>}
      <div className="spread">
        <div><span className="eyebrow">{gradeName(grade)} · {school.name}</span>
          <h1>My progress<Info label="My progress">{"Where you are in each subject and what will move you up a level. You don't do any work on this page: your lessons on Today and My week work through these skills for you, and they tick off here as you master them."}</Info></h1></div>
        {next && <div className="card tight" style={{ textAlign: "right" }}><span className="eyebrow">Next check-up</span><b>{fmtDate(new Date(`${next}T00:00:00Z`), { weekday: "long", month: "long", day: "numeric" })}</b>
          <Info label="Monthly check-up">{"On the last school Friday of each month you do a short check-up. Each subject starts where you left off, so the subjects you've improved in move up a level, and your lessons move up with them."}</Info></div>}
      </div>

      <section className="grid3">
        <div className="stat above"><span className="n">{counts.above}</span><span>above grade level</span></div>
        <div className="stat at"><span className="n">{counts.at}</span><span>at grade level</span></div>
        <div className="stat below"><span className="n">{counts.below}</span><span>below grade level</span></div>
      </section>

      <section className="stack">
        <div className="section-head"><h2>My subjects<Info label="My subjects">{"Each card shows the level you work at now and how many of the skills for the next level you've mastered. Open See the skills to see which ones are done. There's nothing to click there: your lessons work through them in order."}</Info></h2></div>
        <div className="news wide">
          {scored.results.map(r => {
            const req = nextLevelSkills(r, scored.assessment.grade, scored.skillsAt);
            const got = req.filter(q => stateOf(r.sid, q.skill) === "mastered").length;
            const pct = req.length ? Math.round((got / req.length) * 100) : 100;
            return (
              <article key={r.sid} className="ncard subject">
                <div className="ncard-top"><span className="eyebrow">{r.name}</span><StatusPill status={r.status} /></div>
                <h3>Working at {r.working < 0 ? "pre-Kindergarten" : gradeName(r.working)} level</h3>
                <Ruler status={r.status} grade={scored.assessment.grade} working={r.working} />
                <div className="stack" style={{ gap: 4 }}>
                  <span className="small"><b>{got} of {req.length}</b> skills to reach {gradeName(nextTarget(r))} level</span>
                  <div className="progress" role="progressbar" aria-label={`${r.name}: skills to the next level`} aria-valuemin={0} aria-valuemax={req.length} aria-valuenow={got}><i style={{ width: `${pct}%` }} /></div>
                </div>
                {req.length > 0 && (
                  <details className="skills-list"><summary className="small">See the skills</summary>
                    <ul>{req.map(q => {
                      const st = stateOf(r.sid, q.skill);
                      return <li key={q.skill}><span className={`chip ${st === "mastered" ? "above" : st === "help" ? "below" : st === "learning" ? "at" : ""}`}>{st === "mastered" ? "✓ Mastered" : st === "help" ? "Ask for help" : st === "learning" ? "Learning" : "Coming up"}</span> {q.skill}</li>;
                    })}</ul>
                  </details>
                )}
              </article>
            );
          })}
          <article className="ncard ent">
            <div className="ncard-top"><span className="eyebrow">Presumptuous Project</span></div>
            <h3>{ENT_NAME}</h3>
            <span className="small muted">This month: {unit.title}</span>
            <div className="stack" style={{ gap: 4 }}>
              <span className="small"><b>{entDone} of {entAll.length}</b> business and life skills this year</span>
              <div className="progress" role="progressbar" aria-label="Business and life skills this year" aria-valuemin={0} aria-valuemax={entAll.length} aria-valuenow={entDone}><i style={{ width: `${Math.round((entDone / Math.max(1, entAll.length)) * 100)}%` }} /></div>
            </div>
            <details className="skills-list"><summary className="small">See this month&apos;s skills</summary>
              <ul>{skillsOf(unit, grade).map(s => {
                const m = mastered.has(`${ENT}|${s.skill}`);
                return <li key={s.skill}><span className={`chip ${m ? "above" : ""}`}>{m ? "✓ Mastered" : "Coming up"}</span> {s.skill}</li>;
              })}</ul>
            </details>
          </article>
        </div>
      </section>

      <section className="stack">
        <div className="section-head"><h2>My path this year<Info label="My path this year">{"Where each subject is heading by June. Each step happens as you master skills and move up at your monthly check-ups."}</Info></h2></div>
        <div className="tablewrap"><table>
          <tbody>{plan.traj.map(t => (
            <tr key={t.name}><td><b>{t.name}</b></td><td><span className="row" style={{ gap: 6 }}>{t.steps.map((s, i) => (
              <span key={i} className="row" style={{ gap: 6 }}>{i > 0 && <span className="muted">→</span>}<span className={`pill ${s.st}`}>{s.when}: {ST[s.st]}</span></span>
            ))}</span></td></tr>
          ))}</tbody>
        </table></div>
      </section>

      <p className="row"><Link className="btn" href="/student">Back to Today</Link><Link className="btn" href={`/students/${user.id}/portfolio`}>My portfolio</Link><Link className="btn" href="/student/projects">My projects</Link>{report && <Link className="btn" href={`/students/${user.id}/report`}>My report card</Link>}</p>
    </Shell>
  );
}
