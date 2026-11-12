import Link from "next/link";
import { requireSchoolUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { SplitBar, StatusPill } from "@/components/Status";
import { PasswordForm } from "@/components/PasswordForm";
import { countStatuses, dayInfo, latestResults } from "@/lib/records";
import { addDays, fmtStamp } from "@/lib/dates";
import { gradeName, SUBJECT_BY_ID } from "@/lib/subjects";
import { linkChild } from "./actions";

export const metadata = { title: "My children" };

export default async function ParentHome() {
  const { user, school } = await requireSchoolUser(["PARENT"]);
  const links = await db.parentLink.findMany({ where: { parentId: user.id }, include: { student: true }, orderBy: { createdAt: "asc" } });
  const kids = links.map(l => l.student);
  const ids = kids.map(k => k.id);
  const info = await dayInfo(school);
  const [latest, att, inProgress] = await Promise.all([
    latestResults(ids),
    db.attendance.findMany({ where: { studentId: { in: ids }, date: { gte: addDays(info.date, -30) } } }),
    db.assessment.findMany({ where: { studentId: { in: ids }, status: "IN_PROGRESS" }, select: { studentId: true } }),
  ]);
  const going = new Set(inProgress.map(a => a.studentId));
  return (
    <Shell user={user}>
      <div><span className="eyebrow">{school.name}</span><h1>My children</h1></div>
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
                <Link className="btn small primary" href={`/students/${k.id}`}>See plan</Link>
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
              <p className="small">
                Today: {info.schoolDay ? (t ? t.status.toLowerCase() : "attendance not taken yet") : `no school (${info.reason})`}
                {" · "}Last 30 days: {n("PRESENT")} present, {n("LATE")} late, {n("ABSENT")} absent
              </p>
            </div>
          );
        })}</div>
      ) : <div className="empty"><b>No children linked yet</b><span>Add one with the family code from the school.</span></div>}
      <form action={linkChild} className="card">
        <h2>Add a child</h2>
        <div className="form-grid">
          <label className="field">Family code<input id="code" name="code" type="text" autoCapitalize="characters" placeholder="ABCD-2345" required /></label>
          <div><button className="btn primary">Add child</button></div>
        </div>
      </form>
      <PasswordForm />
    </Shell>
  );
}
