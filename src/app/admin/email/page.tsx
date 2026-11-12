import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { Info } from "@/components/Info";
import { appUrl, emailConfigured } from "@/lib/email";
import { fmtStamp } from "@/lib/dates";
import { runWeeklyNow, sendTestEmail } from "../actions";

export const metadata = { title: "Email" };
const KIND = { password_reset: "Password reset", weekly: "Weekly parent email", pilot_alert: "Pilot request alert", invoice: "Invoice", test: "Test" } as Record<string, string>;
const STATUS = { SENT: "Sent", FAILED: "Failed", SKIPPED: "Not sent (email not set up)" } as const;

export default async function EmailPage() {
  const user = await requireUser(["PLATFORM_ADMIN"]);
  const [log, counts] = await Promise.all([
    db.emailLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    db.emailLog.groupBy({ by: ["status"], where: { createdAt: { gte: new Date(Date.now() - 7 * 86400000) } }, _count: true }),
  ]);
  const c = Object.fromEntries(counts.map(x => [x.status, x._count])) as Record<string, number>;
  const on = emailConfigured();
  return (
    <Shell user={user}>
      <div><span className="eyebrow">Platform</span><h1>Email<Info label="Email">{"Every email the platform sends: password resets, the Friday parent email, pilot request alerts to you, and invoices. It sends through Resend once RESEND_API_KEY and EMAIL_FROM are set in Railway. Until then nothing goes out, and each email is listed here as Not sent."}</Info></h1></div>
      <div className="grid3">
        <div className="stat"><span className="n" style={{ fontSize: "1.3rem" }}>{on ? "On" : "Not set up"}</span><span className="small muted">{on ? `From ${process.env.EMAIL_FROM}` : "Add RESEND_API_KEY and EMAIL_FROM in Railway"}</span></div>
        <div className="stat"><span className="n">{c.SENT ?? 0}</span><span className="small muted">Sent in the last 7 days</span></div>
        <div className="stat"><span className="n">{c.FAILED ?? 0}</span><span className="small muted">Failed in the last 7 days</span></div>
      </div>
      <section className="card">
        <h2>Check it works</h2>
        <p className="small muted">Links in emails point to <b>{appUrl()}</b>. If that isn&apos;t your app&apos;s address, set APP_URL in Railway.</p>
        <div className="row">
          <form action={sendTestEmail}><button className="btn">Send me a test email</button></form>
          <form action={runWeeklyNow}><button className="btn">Send this week&apos;s parent emails now</button></form>
          <Info label="Parent emails">{"They send by themselves every Friday from 4 pm in each school's time zone, once per parent per week, to parents who haven't turned them off. Demo schools and weeks with no school days are skipped. Send now is for testing: parents already emailed this week aren't emailed again."}</Info>
        </div>
      </section>
      <section className="stack">
        <h2>Recent emails</h2>
        {log.length ? (
          <div className="tablewrap"><table>
            <thead><tr><th>When</th><th>Kind</th><th>To</th><th>Subject</th><th>Status</th></tr></thead>
            <tbody>{log.map(e => (
              <tr key={e.id}>
                <td className="small">{fmtStamp(e.createdAt, "America/Toronto", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                <td className="small">{KIND[e.kind] ?? e.kind}</td>
                <td className="small">{e.to}</td>
                <td className="small">{e.subject}</td>
                <td><span className={`chip ${e.status === "SENT" ? "above" : e.status === "FAILED" ? "below" : ""}`} title={e.error || undefined}>{STATUS[e.status]}</span></td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <div className="empty"><b>No emails yet</b><span>They&apos;ll show up here as people reset passwords, request pilots and get invoices.</span></div>}
      </section>
    </Shell>
  );
}
