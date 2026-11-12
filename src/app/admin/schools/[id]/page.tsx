import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { addDays, fmtDate, isoDate, todayIn } from "@/lib/dates";
import { licenceState, money } from "@/lib/licence";
import { createInvoice, saveLicence, setInvoiceStatus } from "../../actions";

export const metadata = { title: "School licence" };
const long = { month: "short", day: "numeric", year: "numeric" } as const;

export default async function SchoolLicencePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(["PLATFORM_ADMIN"]);
  const { id } = await params;
  const school = await db.school.findUnique({ where: { id }, include: { invoices: { orderBy: { issuedAt: "desc" } } } });
  if (!school) notFound();
  const [students, coaches, admin] = await Promise.all([
    db.user.count({ where: { schoolId: id, role: "STUDENT", active: true } }),
    db.user.count({ where: { schoolId: id, role: "COACH", active: true } }),
    db.user.findFirst({ where: { schoolId: id, role: "SCHOOL_ADMIN" }, orderBy: { createdAt: "asc" } }),
  ]);
  const today = todayIn(school.timezone);
  const st = licenceState(school, today, students, "admin");
  const start = school.licenceStart ?? today, end = school.licenceEnd ?? addDays(today, 365);
  return (
    <Shell user={user}>
      <div className="spread">
        <div><span className="eyebrow"><Link href="/admin">Schools</Link> · code {school.code}</span><h1>{school.name}</h1></div>
        <span className="chip">{st.label}</span>
      </div>
      {st.warn && <p className="flash error">{st.warn}</p>}
      <div className="grid3">
        <div className="stat"><span className="n">{students}<span className="muted" style={{ fontSize: "1rem" }}> / {school.seats}</span></span><span className="small muted">Students / seats</span></div>
        <div className="stat"><span className="n">{st.daysLeft ?? "–"}</span><span className="small muted">Days left{school.licenceEnd ? ` (ends ${fmtDate(school.licenceEnd, long)})` : ""}</span></div>
        <div className="stat"><span className="n">{coaches}</span><span className="small muted">Coaches · admin {admin ? `${admin.firstName} ${admin.lastName}` : "none"}</span></div>
      </div>

      <form action={saveLicence} className="card">
        <h2>Licence</h2>
        <input type="hidden" name="id" value={school.id} />
        <div className="form-grid">
          <label className="field">Plan
            <select id="plan" name="plan" defaultValue={school.plan}><option value="PILOT">Pilot</option><option value="ACTIVE">Active licence</option></select></label>
          <label className="field">Seats (students)<input id="seats" name="seats" type="number" min={1} defaultValue={school.seats} required /></label>
          <label className="field">Price per student per year (CAD)<input id="price" name="price" type="number" min={0} step="0.01" defaultValue={(school.priceCents / 100).toFixed(2)} /></label>
        </div>
        <div className="form-grid">
          <label className="field">Starts<input id="licenceStart" name="licenceStart" type="date" defaultValue={isoDate(start)} required /></label>
          <label className="field">Ends<input id="licenceEnd" name="licenceEnd" type="date" defaultValue={isoDate(end)} required /></label>
          <label className="field">Billing email<input id="billingEmail" name="billingEmail" type="email" defaultValue={school.billingEmail} /></label>
        </div>
        <div><button className="btn primary">Save licence</button></div>
      </form>

      <section className="card">
        <h2>Invoices</h2>
        {school.invoices.length ? (
          <div className="tablewrap"><table>
            <thead><tr><th>Number</th><th>Issued</th><th>Period</th><th>Seats</th><th>Total</th><th>Status</th><th></th></tr></thead>
            <tbody>{school.invoices.map(inv => (
              <tr key={inv.id}>
                <td className="num"><Link href={`/invoices/${inv.id}`}>{inv.number}</Link></td>
                <td className="small">{fmtDate(todayIn(school.timezone, inv.issuedAt), long)}</td>
                <td className="small">{fmtDate(inv.periodStart, long)} – {fmtDate(inv.periodEnd, long)}</td>
                <td className="num">{inv.seats}</td>
                <td className="num">{money(inv.totalCents)}</td>
                <td><span className="chip">{inv.status === "UNPAID" ? `Due ${fmtDate(inv.dueDate, long)}` : inv.status === "PAID" ? "Paid" : "Void"}</span></td>
                <td><div className="row">
                  {inv.status !== "PAID" && <form action={setInvoiceStatus}><input type="hidden" name="id" value={inv.id} /><input type="hidden" name="status" value="PAID" /><button className="btn small">Mark paid</button></form>}
                  {inv.status === "UNPAID" && <form action={setInvoiceStatus}><input type="hidden" name="id" value={inv.id} /><input type="hidden" name="status" value="VOID" /><button className="btn small danger">Void</button></form>}
                  {inv.status !== "UNPAID" && <form action={setInvoiceStatus}><input type="hidden" name="id" value={inv.id} /><input type="hidden" name="status" value="UNPAID" /><button className="btn small">Mark unpaid</button></form>}
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <p className="muted">No invoices yet.</p>}
        <form action={createInvoice} className="stack">
          <h3>New invoice</h3>
          <input type="hidden" name="id" value={school.id} />
          <div className="form-grid">
            <label className="field">Period start<input id="periodStart" name="periodStart" type="date" defaultValue={isoDate(start)} required /></label>
            <label className="field">Period end<input id="periodEnd" name="periodEnd" type="date" defaultValue={isoDate(end)} required /></label>
            <label className="field">Due in (days)<input id="dueDays" name="dueDays" type="number" min={0} defaultValue={30} /></label>
          </div>
          <div className="form-grid">
            <label className="field">Seats<input id="invSeats" name="seats" type="number" min={1} defaultValue={school.seats} required /></label>
            <label className="field">Price per student (CAD)<input id="invPrice" name="price" type="number" min={0} step="0.01" defaultValue={(school.priceCents / 100).toFixed(2)} required /></label>
            <label className="field">Note on the invoice<input id="notes" name="notes" type="text" maxLength={500} placeholder="Optional, e.g. PO number" /></label>
          </div>
          <p className="small muted">13% HST is added. Numbers run PL-year-0001, PL-year-0002 and so on.</p>
          <div><button className="btn primary">Create invoice</button></div>
        </form>
      </section>
    </Shell>
  );
}
