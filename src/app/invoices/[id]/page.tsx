import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Logo } from "@/components/Logo";
import { fmtDate, todayIn } from "@/lib/dates";
import { HST_RATE, money } from "@/lib/licence";
import { PrintButton } from "./PrintButton";

export const metadata = { title: "Invoice" };
const long = { month: "long", day: "numeric", year: "numeric" } as const;

/** Printable invoice: the platform admin, or a school admin of the invoiced school. */
export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(["PLATFORM_ADMIN", "SCHOOL_ADMIN"]);
  const { id } = await params;
  const inv = await db.invoice.findUnique({ where: { id }, include: { school: true } });
  if (!inv || (user.role === "SCHOOL_ADMIN" && inv.schoolId !== user.schoolId)) notFound();
  const backHref = user.role === "PLATFORM_ADMIN" ? `/admin/schools/${inv.schoolId}` : "/school/billing";
  const supplier = process.env.BILLING_NAME || "Presumptuous Learning";
  const hst = process.env.HST_NUMBER;
  return (
    <div className="wrap invoice">
      <div className="row noprint" style={{ justifyContent: "space-between", padding: "24px 0 16px" }}>
        <Link className="btn" href={backHref}>Back</Link>
        <PrintButton />
      </div>
      <article className="card" style={{ gap: 22, padding: 32 }}>
        <div className="spread" style={{ alignItems: "flex-start" }}>
          <Logo />
          <div style={{ textAlign: "right" }}>
            <h1 style={{ fontSize: "1.6rem" }}>Invoice</h1>
            <div className="num">{inv.number}</div>
            {inv.status !== "UNPAID" && <span className="chip">{inv.status === "PAID" ? `Paid${inv.paidAt ? ` ${fmtDate(todayIn(inv.school.timezone, inv.paidAt), long)}` : ""}` : "Void"}</span>}
          </div>
        </div>
        <div className="grid3">
          <div><span className="eyebrow">From</span><p><b>{supplier}</b>{hst && <><br />HST {hst}</>}</p></div>
          <div><span className="eyebrow">Bill to</span><p><b>{inv.school.name}</b>{inv.school.billingEmail && <><br />{inv.school.billingEmail}</>}</p></div>
          <div><span className="eyebrow">Dates</span><p>Issued {fmtDate(todayIn(inv.school.timezone, inv.issuedAt), long)}<br />Due {fmtDate(inv.dueDate, long)}</p></div>
        </div>
        <div className="tablewrap"><table>
          <thead><tr><th>Description</th><th style={{ textAlign: "right" }}>Students</th><th style={{ textAlign: "right" }}>Price</th><th style={{ textAlign: "right" }}>Amount</th></tr></thead>
          <tbody>
            <tr>
              <td>Presumptuous Learning licence<br /><span className="small muted">{fmtDate(inv.periodStart, long)} to {fmtDate(inv.periodEnd, long)}</span></td>
              <td className="num" style={{ textAlign: "right" }}>{inv.seats}</td>
              <td className="num" style={{ textAlign: "right" }}>{money(inv.unitPriceCents)}</td>
              <td className="num" style={{ textAlign: "right" }}>{money(inv.subtotalCents)}</td>
            </tr>
            <tr><td colSpan={3} style={{ textAlign: "right" }}>Subtotal</td><td className="num" style={{ textAlign: "right" }}>{money(inv.subtotalCents)}</td></tr>
            <tr><td colSpan={3} style={{ textAlign: "right" }}>HST ({Math.round(HST_RATE * 100)}%)</td><td className="num" style={{ textAlign: "right" }}>{money(inv.taxCents)}</td></tr>
            <tr><td colSpan={3} style={{ textAlign: "right" }}><b>Total (CAD)</b></td><td className="num" style={{ textAlign: "right" }}><b>{money(inv.totalCents)}</b></td></tr>
          </tbody>
        </table></div>
        {inv.notes && <p className="small">{inv.notes}</p>}
      </article>
    </div>
  );
}
