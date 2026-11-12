import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { addDays, fmtDate, isoDate, todayIn } from "@/lib/dates";
import { licenceState, money } from "@/lib/licence";
import { Info } from "@/components/Info";
import { resendInvoice, createInvoice, saveLicence, setInvoiceStatus } from "../../actions";

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
        <span className="row"><span className="chip">{st.label}</span><Info label="This page">Only you (platform admin) see this page. It controls what this school has bought: how many students it can add, until when, and what you invoice it. School admins see the result under Billing.</Info></span>
      </div>
      {st.warn && <p className="flash error">{st.warn}</p>}
      <div className="grid3">
        <div className="stat"><span className="n">{students}<span className="muted" style={{ fontSize: "1rem" }}> / {school.seats}</span></span><span className="small muted">Students / seats<Info label="Students / seats">Active students now, out of the seats the licence allows. Only students use seats; coaches, parents and admins are free. When all seats are used, the school can&apos;t add, import or reactivate students. Deactivating a student frees their seat.</Info></span></div>
        <div className="stat"><span className="n">{st.daysLeft ?? "–"}</span><span className="small muted">Days left{school.licenceEnd ? ` (ends ${fmtDate(school.licenceEnd, long)})` : ""}<Info label="Days left">Days until the licence end date. From 30 days out, the school admin sees a renewal banner. After it ends, the admin and coaches see a banner, but nothing is locked: renewing is a conversation, not a shutdown.</Info></span></div>
        <div className="stat"><span className="n">{coaches}</span><span className="small muted">Coaches<Info label="Coaches">Active coaches at the school, plus the first school admin (your main contact). Coaches don&apos;t count towards seats.</Info> · admin {admin ? `${admin.firstName} ${admin.lastName}` : "none"}</span></div>
      </div>

      <form action={saveLicence} className="card">
        <h2>Licence<Info label="Licence">Saving here changes the school&apos;s limits straight away. Changing the price here doesn&apos;t change invoices already sent; it&apos;s the starting price for new ones.</Info></h2>
        <input type="hidden" name="id" value={school.id} />
        <div className="form-grid">
          <label className="field" htmlFor="plan"><span>Plan<Info label="Plan">Pilot: a trial, normally 90 days, not usually invoiced. Every new school starts as a Pilot. Active licence: a paying school. Both get every feature; the plan only changes the label the school sees and how you track sales.</Info></span>
            <select id="plan" name="plan" defaultValue={school.plan}><option value="PILOT">Pilot</option><option value="ACTIVE">Active licence</option></select></label>
          <label className="field" htmlFor="seats"><span>Seats (students)<Info label="Seats">The most active students the school can have. Adding one student, importing a CSV or reactivating a student is refused once they&apos;re all used, with a message telling the admin to contact you.</Info></span><input id="seats" name="seats" type="number" min={1} defaultValue={school.seats} required /></label>
          <label className="field" htmlFor="price"><span>Price per student per year (CAD)<Info label="Price per student">Before tax. Used as the default price on new invoices. HST is added on the invoice, not here.</Info></span><input id="price" name="price" type="number" min={0} step="0.01" defaultValue={(school.priceCents / 100).toFixed(2)} /></label>
        </div>
        <div className="form-grid">
          <label className="field" htmlFor="licenceStart"><span>Starts<Info label="Licence dates">The period the school has paid for (or the pilot runs). The end date drives the renewal and ended banners. New invoices use these dates as their billing period by default.</Info></span><input id="licenceStart" name="licenceStart" type="date" defaultValue={isoDate(start)} required /></label>
          <label className="field">Ends<input id="licenceEnd" name="licenceEnd" type="date" defaultValue={isoDate(end)} required /></label>
          <label className="field" htmlFor="billingEmail"><span>Billing email<Info label="Billing email">Printed under Bill to on invoices and shown on the school&apos;s Billing page. Defaults to the first school admin&apos;s email. Nothing is emailed automatically yet.</Info></span><input id="billingEmail" name="billingEmail" type="email" defaultValue={school.billingEmail} /></label>
        </div>
        <div><button className="btn primary">Save licence</button></div>
      </form>

      <section className="card">
        <h2>Invoices<Info label="Invoices">Invoices you&apos;ve issued to this school. The school admin sees every invoice except void ones under Billing, and can print each or save it as a PDF. Payment happens outside the platform (cheque, EFT, board PO); you record it here.</Info></h2>
        {school.invoices.length ? (
          <div className="tablewrap"><table>
            <thead><tr><th>Number</th><th>Issued</th><th>Period</th><th>Seats</th><th>Total</th><th>Status<Info label="Status">Due (date): not paid yet; counts towards what the school owes. Paid: you&apos;ve received payment; the date is recorded. Void: cancelled, hidden from the school. Mistakes can be undone with Mark unpaid.</Info></th><th></th></tr></thead>
            <tbody>{school.invoices.map(inv => (
              <tr key={inv.id}>
                <td className="num"><Link href={`/invoices/${inv.id}`}>{inv.number}</Link></td>
                <td className="small">{fmtDate(todayIn(school.timezone, inv.issuedAt), long)}</td>
                <td className="small">{fmtDate(inv.periodStart, long)} – {fmtDate(inv.periodEnd, long)}</td>
                <td className="num">{inv.seats}</td>
                <td className="num">{money(inv.totalCents)}</td>
                <td><span className="chip">{inv.status === "UNPAID" ? `Due ${fmtDate(inv.dueDate, long)}` : inv.status === "PAID" ? "Paid" : "Void"}</span></td>
                <td><div className="row">
                  {inv.status !== "VOID" && <form action={resendInvoice}><input type="hidden" name="id" value={inv.id} /><button className="btn small">Email</button></form>}
                  {inv.status !== "PAID" && <form action={setInvoiceStatus}><input type="hidden" name="id" value={inv.id} /><input type="hidden" name="status" value="PAID" /><button className="btn small">Mark paid</button></form>}
                  {inv.status === "UNPAID" && <form action={setInvoiceStatus}><input type="hidden" name="id" value={inv.id} /><input type="hidden" name="status" value="VOID" /><button className="btn small danger">Void</button></form>}
                  {inv.status !== "UNPAID" && <form action={setInvoiceStatus}><input type="hidden" name="id" value={inv.id} /><input type="hidden" name="status" value="UNPAID" /><button className="btn small">Mark unpaid</button></form>}
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <p className="muted">No invoices yet.</p>}
        <form action={createInvoice} className="stack">
          <h3>New invoice<Info label="New invoice">Amount = students × price per student. 13% Ontario HST is added on top. The number is given automatically: PL, the year, then the next number (PL-2026-0001, PL-2026-0002…). Invoices can&apos;t be edited; void one and create a new one instead.</Info></h3>
          <input type="hidden" name="id" value={school.id} />
          <div className="form-grid">
            <label className="field" htmlFor="periodStart"><span>Period start<Info label="Billing period">The dates this invoice pays for, printed on the invoice line. Defaults to the licence dates.</Info></span><input id="periodStart" name="periodStart" type="date" defaultValue={isoDate(start)} required /></label>
            <label className="field">Period end<input id="periodEnd" name="periodEnd" type="date" defaultValue={isoDate(end)} required /></label>
            <label className="field" htmlFor="dueDays"><span>Due in (days)<Info label="Due in">Days from today until payment is due. 30 is usual; school boards often need 45 or 60.</Info></span><input id="dueDays" name="dueDays" type="number" min={0} defaultValue={30} /></label>
          </div>
          <div className="form-grid">
            <label className="field" htmlFor="invSeats"><span>Seats<Info label="Seats on the invoice">How many students you&apos;re billing for. Usually the licence seats, but it can differ (for example, a top-up of 20 seats partway through the year).</Info></span><input id="invSeats" name="seats" type="number" min={1} defaultValue={school.seats} required /></label>
            <label className="field">Price per student (CAD)<input id="invPrice" name="price" type="number" min={0} step="0.01" defaultValue={(school.priceCents / 100).toFixed(2)} required /></label>
            <label className="field" htmlFor="notes"><span>Note on the invoice<Info label="Note">Printed at the bottom of the invoice. Use it for a purchase order number, payment instructions or a discount explanation.</Info></span><input id="notes" name="notes" type="text" maxLength={500} placeholder="Optional, e.g. PO number" /></label>
          </div>
          <p className="small muted">13% HST is added. Numbers run PL-year-0001, PL-year-0002 and so on.</p>
          <div><button className="btn primary">Create invoice</button></div>
        </form>
      </section>
    </Shell>
  );
}
