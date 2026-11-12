import "server-only";
import { db } from "./db";

/**
 * Outgoing email through Resend (https://resend.com), using its HTTP API.
 * Without RESEND_API_KEY and EMAIL_FROM, nothing is sent: each email is logged as SKIPPED
 * so the rest of the platform keeps working and admins can see what would have gone out.
 */
export const emailConfigured = () => !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

/** Public base URL for links in emails, e.g. https://app.presumptuouslearning.ca */
export function appUrl(): string {
  const u = process.env.APP_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "http://localhost:3000");
  return u.replace(/\/+$/, "");
}

export type Email = { to: string; subject: string; kind: string; heading: string; paragraphs: (string | { html: string })[]; button?: { label: string; href: string }; footer?: string; unsubscribe?: string; schoolId?: string | null; dedupeKey?: string };

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function renderEmail(e: Email): { html: string; text: string } {
  const body = e.paragraphs.map(p => typeof p === "string" ? `<p style="margin:0 0 14px">${esc(p)}</p>` : p.html).join("");
  const button = e.button ? `<p style="margin:22px 0"><a href="${esc(e.button.href)}" style="background:#FAB137;color:#2A2A2D;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:999px;display:inline-block">${esc(e.button.label)}</a></p>` : "";
  const html = `<!doctype html><html><body style="margin:0;background:#F4F4F2;font-family:Montserrat,'Helvetica Neue',Arial,sans-serif;color:#2A2A2D">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
<div style="font-weight:800;font-size:15px;line-height:1.1;margin-bottom:16px"><span style="display:inline-block;width:14px;height:14px;background:#FAB137;margin-right:8px;vertical-align:-2px"></span>presumptuous learning</div>
<div style="background:#fff;border:1px solid #DADAD5;border-top:4px solid #FAB137;border-radius:12px;padding:24px;font-size:15px;line-height:1.55">
<h1 style="font-size:21px;margin:0 0 14px">${esc(e.heading)}</h1>${body}${button}</div>
<p style="font-size:12px;color:#64646A;margin:16px 4px">${e.footer ? esc(e.footer) : "Presumptuous Learning · Overreaching is how students get ahead."}${e.unsubscribe ? ` <a href="${esc(e.unsubscribe)}" style="color:#64646A">Stop these emails</a>.` : ""}</p>
</div></body></html>`;
  const text = [e.heading, "", ...e.paragraphs.map(p => typeof p === "string" ? p : p.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()), e.button ? `${e.button.label}: ${e.button.href}` : "", "", e.footer ?? "", e.unsubscribe ? `Stop these emails: ${e.unsubscribe}` : ""].join("\n");
  return { html, text };
}

/** Sends (or records as skipped) one email. A dedupeKey is kept only once sent, so skipped or failed emails are tried again on the next run. Never throws: email trouble must not break a page. Returns the log status. */
export async function sendEmail(e: Email): Promise<"SENT" | "FAILED" | "SKIPPED" | "DUPLICATE"> {
  if (e.dedupeKey && (await db.emailLog.findUnique({ where: { dedupeKey: e.dedupeKey } }))) return "DUPLICATE";
  const log = async (status: "SENT" | "FAILED" | "SKIPPED", error = "") => {
    try {
      await db.emailLog.create({ data: { kind: e.kind, to: e.to, subject: e.subject, status, error: error.slice(0, 500), dedupeKey: status === "SENT" ? e.dedupeKey : null, schoolId: e.schoolId ?? null } });
    } catch { /* a duplicate dedupeKey from a parallel run: fine */ }
    return status;
  };
  if (!emailConfigured()) return log("SKIPPED", "Email isn't set up (RESEND_API_KEY and EMAIL_FROM).");
  const { html, text } = renderEmail(e);
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [e.to], subject: e.subject, html, text, reply_to: process.env.EMAIL_REPLY_TO || undefined,
        headers: e.unsubscribe ? { "List-Unsubscribe": `<${e.unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : undefined }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return log("FAILED", `${r.status} ${await r.text().catch(() => "")}`);
    return log("SENT");
  } catch (err) {
    return log("FAILED", err instanceof Error ? err.message : String(err));
  }
}
