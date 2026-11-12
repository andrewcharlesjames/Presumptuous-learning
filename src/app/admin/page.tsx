import Link from "next/link";
import { Info } from "@/components/Info";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { fmtDate } from "@/lib/dates";
import { createDemoAction, createSchoolAction, deleteDemoAction } from "./actions";

export const metadata = { title: "Schools" };

export default async function AdminPage() {
  const user = await requireUser(["PLATFORM_ADMIN"]);
  const schools = await db.school.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { users: true, classes: true } } } });
  const students = await db.user.groupBy({ by: ["schoolId"], where: { role: "STUDENT", active: true }, _count: true });
  const studentCount = new Map(students.map(s => [s.schoolId, s._count]));
  const newLeads = await db.lead.count({ where: { status: "NEW" } });
  return (
    <Shell user={user}>
      {newLeads > 0 && <p className="flash ok"><span>{newLeads} new pilot request{newLeads === 1 ? "" : "s"}. <Link href="/admin/leads">Review</Link></span></p>}
      <div className="spread">
        <div><span className="eyebrow">Platform</span><h1>Schools</h1></div>
        <form action={createDemoAction}><button className="btn">Create a demo school</button></form>
      </div>
      {schools.length ? (
        <div className="tablewrap"><table>
          <thead><tr><th>School</th><th>Code</th><th>Students<Info label="Students">Active students / seats on the licence.</Info></th><th>Classes</th><th>Licence<Info label="Licence">Pilot or Active, and when it ends. Click a school&apos;s name to change its seats, dates and price, and to create invoices.</Info></th><th></th></tr></thead>
          <tbody>{schools.map(s => (
            <tr key={s.id}>
              <td><Link href={`/admin/schools/${s.id}`}><b>{s.name}</b></Link>{s.isDemo && <span className="chip" style={{ marginLeft: 8 }}>Demo</span>}</td>
              <td className="num">{s.code}</td>
              <td className="num">{studentCount.get(s.id) ?? 0} / {s.seats}</td>
              <td className="num">{s._count.classes}</td>
              <td className="small">{s.plan === "ACTIVE" ? "Active" : "Pilot"}<span className="muted">{s.licenceEnd ? ` · ends ${fmtDate(s.licenceEnd, { month: "short", day: "numeric", year: "numeric" })}` : ""}</span></td>
              <td>{s.isDemo && <form action={deleteDemoAction}><input type="hidden" name="id" value={s.id} /><button className="btn small danger">Delete demo</button></form>}</td>
            </tr>
          ))}</tbody>
        </table></div>
      ) : <div className="empty"><b>No schools yet</b><span>Create your first school below, or a demo school to show prospects.</span></div>}
      <form action={createSchoolAction} className="card">
        <h2>Add a school</h2>
        <p className="muted small">Creates the school with the default school day and this year&apos;s Ontario calendar, plus an account for its school admin. You&apos;ll get a temporary password to send them.</p>
        <div className="form-grid">
          <label className="field">School name<input id="name" name="name" type="text" required /></label>
          <label className="field">School code<span className="hint">Optional. Students type it to sign in.</span><input id="code" name="code" type="text" maxLength={12} /></label>
        </div>
        <div className="form-grid">
          <label className="field">Admin first name<input id="firstName" name="firstName" type="text" required /></label>
          <label className="field">Admin last name<input id="lastName" name="lastName" type="text" required /></label>
          <label className="field">Admin email<input id="email" name="email" type="email" required /></label>
        </div>
        <div><button className="btn primary">Create school</button></div>
      </form>
    </Shell>
  );
}
