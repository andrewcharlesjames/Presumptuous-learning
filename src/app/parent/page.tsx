import { Info } from "@/components/Info";
import Link from "next/link";
import { requireSchoolUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { SplitBar, StatusPill } from "@/components/Status";
import { PasswordForm } from "@/components/PasswordForm";
import { countStatuses, dayInfo, latestResults } from "@/lib/records";
import { practiceSummary } from "@/lib/practice";
import { addDays, fmtStamp, isoDate, schoolYearOf, todayIn } from "@/lib/dates";
import { PROJECT_LABEL } from "@/lib/projects";
import { dayStatuses, streaks, weekRange } from "@/lib/schoolday";
import { moodLabel } from "@/lib/prompts";
import { WeekStrip } from "@/components/DayParts";
import { completion } from "@/lib/assignments";
import { gradeName, SUBJECT_BY_ID } from "@/lib/subjects";
import { linkChild } from "./actions";
import { consentFor } from "@/lib/consent";
import { ConsentControls } from "@/components/ConsentControls";
import { requestDeletion } from "@/app/privacy-actions/actions";

export const metadata = { title: "My children" };

export default async function ParentHome() {
  const { user, school } = await requireSchoolUser(["PARENT"]);
  const links = await db.parentLink.findMany({ where: { parentId: user.id }, include: { student: true }, orderBy: { createdAt: "asc" } });
  const kids = links.map(l => l.student);
  const ids = kids.map(k => k.id);
  const releasedReports = new Set((await db.reportCard.findMany({ where: { studentId: { in: ids }, status: "FINAL" }, select: { studentId: true } })).map(r => r.studentId));
  const info = await dayInfo(school);
  const [latest, att, inProgress, practice] = await Promise.all([
    latestResults(ids),
    db.attendance.findMany({ where: { studentId: { in: ids }, date: { gte: addDays(info.date, -30) } } }),
    db.assessment.findMany({ where: { studentId: { in: ids }, status: "IN_PROGRESS" }, select: { studentId: true } }),
    practiceSummary(ids, 7),
  ]);
  const going = new Set(inProgress.map(a => a.studentId));
  const week = weekRange(info.date);
  const [weekStatus, streakMap, logs] = await Promise.all([
    dayStatuses(school, ids, week.from, week.to),
    streaks(school, ids),
    db.dailyLog.findMany({ where: { studentId: { in: ids }, date: info.date } }),
  ]);
  const [kidAssignments, sharedNotes] = await Promise.all([
    db.assignment.findMany({ where: { targets: { some: { studentId: { in: ids } } } }, include: { targets: true }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.coachNote.findMany({ where: { studentId: { in: ids }, shared: true }, include: { author: true }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const doneA = await completion(kidAssignments);
  const kidProjects = await db.project.findMany({ where: { studentId: { in: ids }, schoolYear: schoolYearOf(info.date) }, include: { milestones: { orderBy: { position: "asc" } } } });
  const consents = await consentFor(ids);
  const openDeletion = new Set((await db.deletionRequest.findMany({ where: { studentId: { in: ids }, resolvedAt: null }, select: { studentId: true } })).map(r => r.studentId));
  const artCounts = new Map((await db.artwork.groupBy({ by: ["studentId"], where: { studentId: { in: ids } }, _count: true })).map(c => [c.studentId, c._count]));
  return (
    <Shell user={user}>
      <div><span className="eyebrow">{school.name}</span><h1>My children<Info label="Your dashboard">{"Each child's placement, today's work, practice, projects and notes from their coach. Open \"See the full plan\" for every subject and what your child needs to reach the next level."}</Info></h1></div>
      {kids.length ? (
        <div className="grid2">{kids.map(k => {
          const l = latest.get(k.id);
          const c = l ? countStatuses(l.results) : null;
          const mine = att.filter(a => a.studentId === k.id);
          const t = mine.find(a => a.date.getTime() === info.date.getTime());
          const n = (s: string) => mine.filter(a => a.status === s).length;
          return (
            <div key={k.id} className="card">
              <div className="spread">
                <div><h2>{k.firstName} {k.lastName}</h2><span className="small muted">{gradeName(k.grade ?? 0)}</span></div>
                <div className="row" style={{ gap: 6 }}>
                  <Link className="btn small" href={`/students/${k.id}/portfolio`}>Portfolio ({artCounts.get(k.id) ?? 0})</Link>
                  {releasedReports.has(k.id) && <Link className="btn small" href={`/students/${k.id}/report`}>Report card</Link>}
                  <Link className="btn small primary" href={`/students/${k.id}`}>See plan</Link>
                </div>
              </div>
              {l && c ? (
                <>
                  <div className="row small"><SplitBar {...c} /><span className="num">{c.above} above · {c.at} at · {c.below} below</span></div>
                  <div className="stack" style={{ gap: 6 }}>{l.results.map(r => (
                    <div key={r.sid} className="spread small" style={{ alignItems: "center" }}><span>{SUBJECT_BY_ID[r.sid].name(l.grade)}</span><StatusPill status={r.status} /></div>
                  ))}</div>
                  <p className="small muted">Assessed {fmtStamp(l.completedAt, school.timezone, { month: "long", day: "numeric" })}</p>
                </>
              ) : <p className="muted small">{going.has(k.id) ? "Assessment in progress." : "Not assessed yet."}</p>}
              {info.schoolDay && (() => {
                const l = logs.find(x => x.studentId === k.id); const d = weekStatus.get(k.id)?.find(x => x.date === isoDate(info.date));
                return (
                  <div className="stack" style={{ gap: 4, padding: "10px 12px", background: "var(--paper)", borderRadius: 10 }}>
                    <span className="eyebrow">Today</span>
                    <p className="small">{l?.checkedInAt ? <>Checked in feeling <b>{moodLabel(l.mood)}</b>{l.goal && <>. Goal: <b>{l.goal}</b></>}</> : "Hasn't checked in yet."}</p>
                    <p className="small">{d?.learning ? `${d.learning} learning activit${d.learning === 1 ? "y" : "ies"} finished.` : "No lessons or practice finished yet."}</p>
                    {l?.reflectedAt && <p className="small">Reflection: “{l.learned}”{l.question && <> · Question: “{l.question}”</>}</p>}
                  </div>
                );
              })()}
              {(() => {
                const mine = kidAssignments.filter(a => a.targets.some(t => t.studentId === k.id));
                const open = mine.filter(a => !doneA.has(`${a.id}:${k.id}`));
                const note = sharedNotes.find(n => n.studentId === k.id);
                return (
                  <>
                    {mine.length > 0 && <p className="small">Assignments: <b>{mine.length - open.length}</b> done, <b>{open.length}</b> to do{open.some(a => a.dueDate && a.dueDate < info.date) && <> · <span className="pill below">overdue work</span></>}</p>}
                    {note && <p className="small" style={{ padding: "8px 10px", borderLeft: "3px solid var(--accent)" }}>“{note.body.slice(0, 220)}{note.body.length > 220 ? "…" : ""}” — {note.author.firstName}, {school.coachTitle.toLowerCase()}</p>}
                  </>
                );
              })()}
              {kidProjects.filter(p => p.studentId === k.id).map(p => {
                const done = p.milestones.filter(m => m.status === "APPROVED").length;
                return <p key={p.id} className="small"><b>{PROJECT_LABEL[p.type]}:</b> <Link href={`/students/${k.id}/projects`}>{p.title || "choosing an idea"}</Link> · {done} of {p.milestones.length} steps</p>;
              })}
              <p className="small"><b>{streakMap.get(k.id)?.current ?? 0}</b>-day streak</p>
              <details className="items">
                <summary>Privacy, consent and data</summary>
                <div className="stack" style={{ gap: 12, marginTop: 10 }}>
                  <ConsentControls studentId={k.id} state={consents.get(k.id)!} returnTo="/parent" />
                  <p className="small"><a href={`/api/students/${k.id}/export`}>Download all of {k.firstName}&apos;s data (JSON file)</a></p>
                  {openDeletion.has(k.id) ? <p className="small"><span className="pill at">Deletion requested</span> The school will confirm with you.</p> : (
                    <form action={requestDeletion} className="stack" style={{ gap: 6 }}>
                      <input type="hidden" name="studentId" value={k.id} />
                      <label className="field small">Ask the school to delete {k.firstName}&apos;s data<span className="hint">Optional reason</span><input id={`del-${k.id}`} name="reason" type="text" maxLength={500} /></label>
                      <div><button className="btn small danger">Request deletion</button></div>
                    </form>
                  )}
                </div>
              </details>
              <WeekStrip days={weekStatus.get(k.id) ?? []} today={isoDate(info.date)} since={isoDate(todayIn(school.timezone, k.createdAt))} />
              <p className="small">Practice this week: {(() => { const p = practice.get(k.id); return p ? `${p.sets} set${p.sets === 1 ? "" : "s"}, ${p.questions} questions, ${Math.round((p.correct / Math.max(1, p.questions)) * 100)}% correct` : "none yet"; })()}</p>
              <p className="small">
                Today: {info.schoolDay ? (t ? t.status.toLowerCase() : "attendance not taken yet") : `no school (${info.reason})`}
                {" · "}Last 30 days: {n("PRESENT")} present, {n("LATE")} late, {n("ABSENT")} absent
              </p>
            </div>
          );
        })}</div>
      ) : <div className="empty"><b>No children linked yet</b><span>Add one with the family code from the school.</span></div>}
      <form action={linkChild} className="card">
        <h2>Add a child<Info label="Add a child">{"Each child has a family code from their school (ask the office or their coach). Enter it here to see that child too."}</Info></h2>
        <div className="form-grid">
          <label className="field">Family code<input id="code" name="code" type="text" autoCapitalize="characters" placeholder="ABCD-2345" required /></label>
          <div><button className="btn primary">Add child</button></div>
        </div>
      </form>
      <PasswordForm />
    </Shell>
  );
}
