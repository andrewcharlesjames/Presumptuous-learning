import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { fmtStamp } from "@/lib/dates";
import { PILOT_DAYS } from "@/lib/licence";
import { convertLead, setLeadStatus } from "../actions";

export const metadata = { title: "Pilot requests" };
const LABEL = { NEW: "New", CONTACTED: "Contacted", CONVERTED: "Pilot started", CLOSED: "Closed" } as const;

export default async function LeadsPage() {
  const user = await requireUser(["PLATFORM_ADMIN"]);
  const leads = await db.lead.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  const open = leads.filter(l => l.status === "NEW" || l.status === "CONTACTED");
  const done = leads.filter(l => !(l.status === "NEW" || l.status === "CONTACTED"));
  return (
    <Shell user={user}>
      <div><span className="eyebrow">Platform</span><h1>Pilot requests</h1></div>
      <p className="muted">Schools that asked for a pilot from the website. Start a pilot to create the school with a {PILOT_DAYS}-day licence and its admin account.</p>
      {open.length === 0 && <div className="empty"><b>No open requests</b><span>New requests from the website&apos;s pilot form show up here.</span></div>}
      {open.map(l => {
        const [first, ...rest] = l.name.split(/\s+/);
        return (
          <section key={l.id} className="card lead">
            <div className="spread">
              <div><h2>{l.schoolName}</h2><span className="small muted">{fmtStamp(l.createdAt, "America/Toronto", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</span></div>
              <span className="chip">{LABEL[l.status]}</span>
            </div>
            <p><b>{l.name}</b>{l.role && `, ${l.role}`} · <a href={`mailto:${l.email}`}>{l.email}</a>{l.phone && ` · ${l.phone}`}</p>
            <p className="small">{l.students ? `About ${l.students} students` : "Students not given"}{l.grades && ` · Grades ${l.grades}`}</p>
            {l.message && <p className="small" style={{ whiteSpace: "pre-wrap" }}>{l.message}</p>}
            <div className="row">
              {l.status === "NEW" && <form action={setLeadStatus}><input type="hidden" name="id" value={l.id} /><input type="hidden" name="status" value="CONTACTED" /><button className="btn small">Mark contacted</button></form>}
              <form action={setLeadStatus}><input type="hidden" name="id" value={l.id} /><input type="hidden" name="status" value="CLOSED" /><button className="btn small">Close</button></form>
            </div>
            <details>
              <summary className="btn small">Start a pilot</summary>
              <form action={convertLead} className="stack" style={{ marginTop: 12 }}>
                <input type="hidden" name="leadId" value={l.id} />
                <div className="form-grid">
                  <label className="field">School name<input name="name" type="text" defaultValue={l.schoolName} required /></label>
                  <label className="field">School code (optional)<input name="code" type="text" maxLength={12} /></label>
                  <label className="field">Seats<input name="seats" type="number" min={1} defaultValue={l.students ?? 50} required /></label>
                </div>
                <div className="form-grid">
                  <label className="field">Admin first name<input name="firstName" type="text" defaultValue={first} required /></label>
                  <label className="field">Admin last name<input name="lastName" type="text" defaultValue={rest.join(" ")} required /></label>
                  <label className="field">Admin email<input name="email" type="email" defaultValue={l.email} required /></label>
                </div>
                <div><button className="btn primary">Create pilot school</button></div>
              </form>
            </details>
          </section>
        );
      })}
      {done.length > 0 && (
        <section className="card">
          <h2>Earlier requests</h2>
          <div className="tablewrap"><table>
            <thead><tr><th>School</th><th>Contact</th><th>Date</th><th>Status</th><th></th></tr></thead>
            <tbody>{done.map(l => (
              <tr key={l.id}>
                <td>{l.schoolId ? <Link href={`/admin/schools/${l.schoolId}`}>{l.schoolName}</Link> : l.schoolName}</td>
                <td className="small">{l.name} · {l.email}</td>
                <td className="small">{fmtStamp(l.createdAt, "America/Toronto", { month: "short", day: "numeric", year: "numeric" })}</td>
                <td><span className="chip">{LABEL[l.status]}</span></td>
                <td>{l.status === "CLOSED" && <form action={setLeadStatus}><input type="hidden" name="id" value={l.id} /><input type="hidden" name="status" value="NEW" /><button className="btn small">Reopen</button></form>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </section>
      )}
    </Shell>
  );
}
