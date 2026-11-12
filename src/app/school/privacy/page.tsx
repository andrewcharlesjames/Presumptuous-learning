import Link from "next/link";
import { requireSchoolUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { consentFor } from "@/lib/consent";
import { AUDIT_LABEL } from "@/lib/audit";
import { fmtStamp } from "@/lib/dates";
import { gradeShort } from "@/lib/subjects";
import { declineDeletion } from "@/app/privacy-actions/actions";

export const metadata = { title: "Privacy" };

export default async function SchoolPrivacy({ searchParams }: { searchParams: Promise<{ student?: string }> }) {
  const { user, school } = await requireSchoolUser(["SCHOOL_ADMIN"]);
  const { student: filter } = await searchParams;
  const students = await db.user.findMany({ where: { schoolId: school.id, role: "STUDENT" }, select: { id: true, firstName: true, lastName: true, grade: true }, orderBy: [{ grade: "asc" }, { lastName: "asc" }] });
  const byId = new Map(students.map(s => [s.id, s]));
  const [consents, requests, events] = await Promise.all([
    consentFor(students.map(s => s.id)),
    db.deletionRequest.findMany({ where: { schoolId: school.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.auditEvent.findMany({ where: { schoolId: school.id, ...(filter ? { studentId: filter } : {}) }, orderBy: { createdAt: "desc" }, take: 200 }),
  ]);
  const open = requests.filter(r => !r.resolvedAt);
  const count = (k: "platform" | "ai", v: boolean | null) => students.filter(s => consents.get(s.id)![k] === v).length;
  return (
    <Shell user={user}>
      <div><span className="eyebrow">{school.name}</span><h1>Privacy</h1>
        <p className="muted small" style={{ marginTop: 6, maxWidth: "70ch" }}>Consent, data requests and a record of who has viewed or changed student records. AI features {school.aiNeedsConsent ? "need" : "don't need"} a parent&apos;s consent at your school (change it in Settings). Families can read the <Link href="/privacy">privacy notice</Link>.</p></div>

      <section className="stack">
        <h2>Deletion requests {open.length > 0 && <span className="pill below">{open.length} open</span>}</h2>
        {requests.length ? (
          <div className="tablewrap"><table>
            <thead><tr><th>Student</th><th>Requested by</th><th>Reason</th><th>When</th><th>Outcome</th></tr></thead>
            <tbody>{requests.map(r => {
              const s = byId.get(r.studentId);
              return (
                <tr key={r.id}>
                  <td>{s ? <Link href={`/students/${s.id}`}>{s.firstName} {s.lastName}</Link> : <span className="muted">Deleted student</span>}</td>
                  <td className="small">{r.byName}</td><td className="small">{r.reason || "—"}</td>
                  <td className="small num">{fmtStamp(r.createdAt, school.timezone, { month: "short", day: "numeric", year: "numeric" })}</td>
                  <td className="small">{r.resolvedAt ? r.outcome : (
                    <div className="stack" style={{ gap: 6 }}>
                      {s && <Link className="btn small danger" href={`/students/${s.id}`}>Review and delete</Link>}
                      <form action={declineDeletion} className="row" style={{ gap: 6 }}><input type="hidden" name="id" value={r.id} /><input aria-label="Reason for declining" name="note" type="text" placeholder="Reason (e.g. legal hold)" style={{ width: 180 }} /><button className="btn small">Decline</button></form>
                    </div>
                  )}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        ) : <p className="muted small">No deletion requests.</p>}
      </section>

      <section className="stack">
        <h2>Consent</h2>
        <p className="small num">Platform use: {count("platform", true)} given · {count("platform", null)} not given yet · {count("platform", false)} withdrawn. AI features: {count("ai", true)} given · {count("ai", null)} not given yet · {count("ai", false)} withdrawn.</p>
        <div className="tablewrap"><table>
          <thead><tr><th>Student</th><th>Grade</th><th>Platform use</th><th>AI features</th></tr></thead>
          <tbody>{students.map(s => {
            const c = consents.get(s.id)!;
            const cell = (v: boolean | null, by?: string) => <span className={`pill ${v === true ? "above" : v === false ? "below" : "none"}`} title={by}>{v === true ? "Given" : v === false ? "Withdrawn" : "Not yet"}</span>;
            return <tr key={s.id}><td><Link href={`/students/${s.id}`}>{s.firstName} {s.lastName}</Link></td><td className="num">{gradeShort(s.grade ?? 0)}</td><td>{cell(c.platform, c.platformBy)}</td><td>{cell(c.ai, c.aiBy)}</td></tr>;
          })}</tbody>
        </table></div>
      </section>

      <section className="stack">
        <div className="spread"><h2>Audit log{filter && byId.get(filter) ? `: ${byId.get(filter)!.firstName} ${byId.get(filter)!.lastName}` : ""}</h2>{filter && <Link href="/school/privacy" className="small">Show everyone</Link>}</div>
        <p className="small muted">The latest 200 events. Each view of a student&apos;s records by staff or a parent is recorded, as are exports, deletions, password resets and changes.</p>
        {events.length ? (
          <div className="tablewrap"><table>
            <thead><tr><th>When</th><th>Who</th><th>What</th><th>Student</th><th>Detail</th></tr></thead>
            <tbody>{events.map(e => {
              const s = e.studentId ? byId.get(e.studentId) : undefined;
              return (
                <tr key={e.id}>
                  <td className="small num">{fmtStamp(e.createdAt, school.timezone, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                  <td className="small">{e.actorName}<br /><span className="muted">{e.actorRole.replace("_", " ").toLowerCase()}</span></td>
                  <td className="small">{AUDIT_LABEL[e.action] ?? e.action}</td>
                  <td className="small">{s ? <Link href={`/school/privacy?student=${s.id}`}>{s.firstName} {s.lastName}</Link> : e.studentId ? <span className="muted">Deleted student</span> : "—"}</td>
                  <td className="small">{e.detail}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        ) : <p className="muted small">Nothing recorded yet.</p>}
      </section>
    </Shell>
  );
}
