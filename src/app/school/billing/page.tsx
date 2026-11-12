import Link from "next/link";
import { requireSchoolUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { fmtDate, todayIn } from "@/lib/dates";
import { licenceState, money } from "@/lib/licence";

export const metadata = { title: "Plan & billing" };
const long = { month: "long", day: "numeric", year: "numeric" } as const;

export default async function BillingPage() {
  const { user, school } = await requireSchoolUser(["SCHOOL_ADMIN"]);
  const [students, invoices] = await Promise.all([
    db.user.count({ where: { schoolId: school.id, role: "STUDENT", active: true } }),
    db.invoice.findMany({ where: { schoolId: school.id, status: { not: "VOID" } }, orderBy: { issuedAt: "desc" } }),
  ]);
  const today = todayIn(school.timezone);
  const st = licenceState(school, today, students);
  const owing = invoices.filter(i => i.status === "UNPAID").reduce((a, i) => a + i.totalCents, 0);
  return (
    <Shell user={user}>
      <div><span className="eyebrow">{school.name}</span><h1>Plan &amp; billing</h1></div>
      <div className="grid3">
        <div className="stat"><span className="n" style={{ fontSize: "1.4rem" }}>{st.label}</span><span className="small muted">{school.licenceEnd ? `${st.daysLeft! < 0 ? "Ended" : "Runs until"} ${fmtDate(school.licenceEnd, long)}` : "No end date set"}</span></div>
        <div className="stat"><span className="n">{students}<span className="muted" style={{ fontSize: "1rem" }}> / {school.seats}</span></span><span className="small muted">Students using seats</span></div>
        <div className="stat"><span className="n">{money(owing)}</span><span className="small muted">Owing</span></div>
      </div>
      <section className="card">
        <h2>What&apos;s included</h2>
        <p>Every subject&apos;s placement assessment, daily plans, AI lessons and mastery checks, the AI tutor, the school day, the studio and portfolio, the Life Skills and Purpose Projects with Launch Day, and accounts for every coach, parent and admin. Only students use seats.</p>
        <p className="small muted">To add seats, renew or change your plan, contact Presumptuous Learning{school.billingEmail ? `. Invoices go to ${school.billingEmail}` : ""}. Deactivated students free up their seat.</p>
      </section>
      <section className="card">
        <h2>Invoices</h2>
        {invoices.length ? (
          <div className="tablewrap"><table>
            <thead><tr><th>Number</th><th>Period</th><th>Students</th><th>Total</th><th>Status</th></tr></thead>
            <tbody>{invoices.map(inv => (
              <tr key={inv.id}>
                <td className="num"><Link href={`/invoices/${inv.id}`}>{inv.number}</Link></td>
                <td className="small">{fmtDate(inv.periodStart, long)} – {fmtDate(inv.periodEnd, long)}</td>
                <td className="num">{inv.seats}</td>
                <td className="num">{money(inv.totalCents)}</td>
                <td><span className="chip">{inv.status === "PAID" ? "Paid" : `Due ${fmtDate(inv.dueDate, long)}`}</span></td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <p className="muted">No invoices yet.{school.plan === "PILOT" ? " Pilots aren't invoiced." : ""}</p>}
      </section>
    </Shell>
  );
}
