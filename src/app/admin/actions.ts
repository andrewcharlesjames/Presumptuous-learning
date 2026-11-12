"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { setFlash } from "@/lib/flash";
import { hashPassword, kidPassword, tempPassword } from "@/lib/passwords";
import { issueResetLink } from "@/lib/resets";
import { audit } from "@/lib/audit";
import { createSchool, uniqueSchoolCode } from "@/lib/records";
import { createDemoSchool } from "@/lib/demo";
import { addDays, fmtDate, parseIsoDate, todayIn } from "@/lib/dates";
import { invoiceTotals, money, PILOT_DAYS } from "@/lib/licence";
import { appUrl, sendEmail } from "@/lib/email";
import { runWeekly } from "@/lib/weekly";

const schoolSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().max(12).optional(),
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  email: z.string().trim().email(),
});

export async function createSchoolAction(form: FormData) {
  await requireUser(["PLATFORM_ADMIN"]);
  const parsed = schoolSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    await setFlash({ tone: "error", text: "Fill in the school name and the admin's name and email." });
    redirect("/admin");
  }
  const d = parsed.data;
  if (await db.user.findUnique({ where: { email: d.email.toLowerCase() } })) {
    await setFlash({ tone: "error", text: `${d.email} already has an account. Use a different email for this school's admin.` });
    redirect("/admin");
  }
  const code = await uniqueSchoolCode(d.code || d.name);
  const password = tempPassword();
  await createSchool({ name: d.name, code, admin: { firstName: d.firstName, lastName: d.lastName, email: d.email, password } });
  await setFlash({
    tone: "ok", text: `${d.name} is ready. Send these sign-in details to ${d.firstName}.`,
    secret: [{ label: "School code", value: code }, { label: "Admin email", value: d.email.toLowerCase() }, { label: "Temporary password", value: password }],
  });
  revalidatePath("/admin");
  redirect("/admin");
}

export async function createDemoAction() {
  await requireUser(["PLATFORM_ADMIN"]);
  const { school, logins } = await createDemoSchool();
  await setFlash({ tone: "ok", text: `Created ${school.name} with sample students, classes, assessments and attendance.`, secret: logins });
  revalidatePath("/admin");
  redirect("/admin");
}

export async function createTestSchoolAction(form: FormData) {
  const user = await requireUser(["PLATFORM_ADMIN"]);
  const email = z.string().trim().email().safeParse(form.get("email") || user.email);
  if (!email.success) {
    await setFlash({ tone: "error", text: "Enter an email address you can receive mail at." });
    redirect("/admin");
  }
  const name = String(form.get("name") ?? "").trim().slice(0, 120);
  const { school, logins } = await createDemoSchool({ test: { email: email.data, name } });
  await setFlash({ tone: "ok", text: `Created ${school.name}, a real test school. Every adult account uses a + version of ${email.data.toLowerCase()}, so emails reach your inbox.`, secret: logins });
  revalidatePath("/admin");
  redirect("/admin");
}

export async function deleteDemoAction(form: FormData) {
  await requireUser(["PLATFORM_ADMIN"]);
  const id = String(form.get("id") ?? "");
  const school = await db.school.findUnique({ where: { id } });
  if (school?.isDemo || school?.isTest) {
    await db.school.delete({ where: { id } });
    await setFlash({ tone: "ok", text: `Deleted ${school.name}.` });
  }
  revalidatePath("/admin");
  redirect("/admin");
}

/* ---------------- licences, invoices, leads (Phase 8) ---------------- */

const toAdmin = async (path: string, tone: "ok" | "error", text: string, secret?: { label: string; value: string }[]) => {
  await setFlash({ tone, text, secret });
  revalidatePath(path);
  redirect(path);
};

const licenceSchema = z.object({
  id: z.string().min(1),
  plan: z.enum(["PILOT", "ACTIVE"]),
  seats: z.coerce.number().int().min(1).max(100000),
  licenceStart: z.string(),
  licenceEnd: z.string(),
  price: z.coerce.number().min(0).max(100000),
  billingEmail: z.union([z.literal(""), z.string().trim().email()]),
});

export async function saveLicence(form: FormData) {
  await requireUser(["PLATFORM_ADMIN"]);
  const p = licenceSchema.safeParse(Object.fromEntries(form));
  const id = String(form.get("id") ?? "");
  const path = `/admin/schools/${id}`;
  if (!p.success) return toAdmin(path, "error", "Check the seats, price and billing email.");
  const d = p.data;
  const noEnd = form.get("noEnd") === "on";
  const start = parseIsoDate(d.licenceStart), end = noEnd ? null : parseIsoDate(d.licenceEnd);
  if (!start || (!noEnd && (!end || end <= start))) return toAdmin(path, "error", "The licence must end after it starts, or tick No end date.");
  await db.school.update({
    where: { id: d.id },
    data: { plan: d.plan, seats: d.seats, licenceStart: start, licenceEnd: end, priceCents: Math.round(d.price * 100), billingEmail: d.billingEmail.toLowerCase() },
  });
  return toAdmin(path, "ok", "Licence saved.");
}

const invoiceSchema = z.object({
  id: z.string().min(1),
  periodStart: z.string(),
  periodEnd: z.string(),
  seats: z.coerce.number().int().min(1).max(100000),
  price: z.coerce.number().min(0).max(100000),
  dueDays: z.coerce.number().int().min(0).max(120),
  notes: z.string().trim().max(500).optional(),
});

export async function createInvoice(form: FormData) {
  await requireUser(["PLATFORM_ADMIN"]);
  const id = String(form.get("id") ?? "");
  const path = `/admin/schools/${id}`;
  const p = invoiceSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return toAdmin(path, "error", "Fill in the period, seats and price.");
  const d = p.data;
  const ps = parseIsoDate(d.periodStart), pe = parseIsoDate(d.periodEnd);
  if (!ps || !pe || pe <= ps) return toAdmin(path, "error", "The billing period must end after it starts.");
  const unitPriceCents = Math.round(d.price * 100);
  const totals = invoiceTotals(d.seats, unitPriceCents);
  const today = todayIn("America/Toronto");
  const year = today.getUTCFullYear();
  for (let attempt = 0; attempt < 5; attempt++) {
    const n = await db.invoice.count({ where: { number: { startsWith: `PL-${year}-` } } });
    const number = `PL-${year}-${String(n + 1 + attempt).padStart(4, "0")}`;
    try {
      const inv = await db.invoice.create({
        data: { schoolId: id, number, dueDate: addDays(today, d.dueDays), periodStart: ps, periodEnd: pe, seats: d.seats, unitPriceCents, ...totals, notes: d.notes ?? "" },
      });
      const mailed = await emailInvoice(inv.id);
      return toAdmin(path, "ok", `Invoice ${number} created for ${money(totals.totalCents)}. ${mailed}`);
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e;
    }
  }
  return toAdmin(path, "error", "Couldn't number that invoice. Try again.");
}

export async function setInvoiceStatus(form: FormData) {
  await requireUser(["PLATFORM_ADMIN"]);
  const id = String(form.get("id") ?? "");
  const status = String(form.get("status") ?? "");
  if (!["UNPAID", "PAID", "VOID"].includes(status)) return;
  const inv = await db.invoice.update({ where: { id }, data: { status: status as "UNPAID" | "PAID" | "VOID", paidAt: status === "PAID" ? new Date() : null } });
  return toAdmin(`/admin/schools/${inv.schoolId}`, "ok", `Invoice ${inv.number} marked ${status.toLowerCase()}.`);
}

export async function setLeadStatus(form: FormData) {
  await requireUser(["PLATFORM_ADMIN"]);
  const id = String(form.get("id") ?? "");
  const status = String(form.get("status") ?? "");
  if (!["NEW", "CONTACTED", "CONVERTED", "CLOSED"].includes(status)) return;
  await db.lead.update({ where: { id }, data: { status: status as "NEW" | "CONTACTED" | "CONVERTED" | "CLOSED" } });
  return toAdmin("/admin/leads", "ok", "Lead updated.");
}

const pilotSchema = schoolSchema.extend({ leadId: z.string().min(1), seats: z.coerce.number().int().min(1).max(100000) });

export async function convertLead(form: FormData) {
  await requireUser(["PLATFORM_ADMIN"]);
  const p = pilotSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return toAdmin("/admin/leads", "error", "Fill in the school name, the admin's name and email, and seats.");
  const d = p.data;
  const lead = await db.lead.findUnique({ where: { id: d.leadId } });
  if (!lead) return toAdmin("/admin/leads", "error", "That lead no longer exists.");
  if (lead.schoolId) return toAdmin("/admin/leads", "error", "That lead already has a pilot school.");
  if (await db.user.findUnique({ where: { email: d.email.toLowerCase() } }))
    return toAdmin("/admin/leads", "error", `${d.email} already has an account. Use a different email for this school's admin.`);
  const code = await uniqueSchoolCode(d.code || d.name);
  const password = tempPassword();
  const school = await createSchool({ name: d.name, code, seats: d.seats, admin: { firstName: d.firstName, lastName: d.lastName, email: d.email, password } });
  await db.lead.update({ where: { id: lead.id }, data: { status: "CONVERTED", schoolId: school.id } });
  return toAdmin("/admin/leads", "ok", `${d.name} has a ${PILOT_DAYS}-day pilot for ${d.seats} students. Send these sign-in details to ${d.firstName}.`,
    [{ label: "School code", value: code }, { label: "Admin email", value: d.email.toLowerCase() }, { label: "Temporary password", value: password }]);
}

/** Emails an invoice to the school's billing email. Returns a sentence for the flash message. */
async function emailInvoice(invoiceId: string): Promise<string> {
  const inv = await db.invoice.findUnique({ where: { id: invoiceId }, include: { school: true } });
  if (!inv) return "";
  if (!inv.school.billingEmail) return "The school has no billing email, so it wasn't emailed. The school admin can see it under Billing.";
  const r = await sendEmail({
    kind: "invoice", to: inv.school.billingEmail, schoolId: inv.schoolId, subject: `Invoice ${inv.number} from Presumptuous Learning`,
    heading: `Invoice ${inv.number}`,
    paragraphs: [
      `${inv.school.name}: Presumptuous Learning licence for ${inv.seats} students, ${fmtDate(inv.periodStart, { month: "long", day: "numeric", year: "numeric" })} to ${fmtDate(inv.periodEnd, { month: "long", day: "numeric", year: "numeric" })}.`,
      `Total ${money(inv.totalCents)} (including ${money(inv.taxCents)} HST), due ${fmtDate(inv.dueDate, { month: "long", day: "numeric", year: "numeric" })}.`,
      "A school admin can open, print or save the invoice as a PDF from Billing.",
    ],
    button: { label: "View the invoice", href: `${appUrl()}/invoices/${inv.id}` },
  });
  return r === "SENT" ? `It was emailed to ${inv.school.billingEmail}.` : r === "SKIPPED" ? "Email isn't set up yet, so it wasn't emailed; the school admin can see it under Billing." : `Emailing it to ${inv.school.billingEmail} failed; see Email for details.`;
}

export async function resendInvoice(form: FormData) {
  await requireUser(["PLATFORM_ADMIN"]);
  const inv = await db.invoice.findUnique({ where: { id: String(form.get("id") ?? "") } });
  if (!inv) redirect("/admin");
  return toAdmin(`/admin/schools/${inv.schoolId}`, "ok", `Invoice ${inv.number}: ${await emailInvoice(inv.id)}`);
}

export async function sendTestEmail() {
  const user = await requireUser(["PLATFORM_ADMIN"]);
  const r = await sendEmail({ kind: "test", to: user.email!, subject: "Test email from Presumptuous Learning", heading: "Email works", paragraphs: ["If you're reading this, Presumptuous Learning can send email."] });
  return toAdmin("/admin/email", r === "SENT" ? "ok" : "error", r === "SENT" ? `Sent a test email to ${user.email}.` : r === "SKIPPED" ? "Email isn't set up yet. Add RESEND_API_KEY and EMAIL_FROM in Railway." : "The test email failed. See the log below.");
}

export async function runWeeklyNow() {
  await requireUser(["PLATFORM_ADMIN"]);
  const r = await runWeekly(new Date(), true);
  return toAdmin("/admin/email", "ok", `Weekly email: ${r.considered} parents considered, ${r.sent} sent, ${r.skipped} skipped (email not set up), ${r.failed} failed. Parents already emailed this week were left alone.`);
}

/* ---------------- people across the platform ---------------- */

const peopleBack = (form: FormData) => {
  const r = String(form.get("returnTo") ?? "");
  return r.startsWith("/admin/people") ? r : "/admin/people";
};

async function targetFor(form: FormData) {
  const me = await requireUser(["PLATFORM_ADMIN"]);
  const target = await db.user.findUnique({ where: { id: String(form.get("id") ?? "") } });
  return { me, target: target && target.id !== me.id ? target : null };
}

export async function adminSendResetLink(form: FormData) {
  const { me, target } = await targetFor(form);
  const path = peopleBack(form);
  if (!target?.email || target.role === "STUDENT") return toAdmin(path, "error", "Only adults with an email can get a reset link. Use Temporary password for students.");
  const r = await issueResetLink(target, "Presumptuous Learning support");
  await audit(me, "password.link", { schoolId: target.schoolId, detail: `${target.firstName} ${target.lastName}` });
  if (r?.status === "SENT") return toAdmin(path, "ok", `Emailed a reset link to ${target.email}. It works once, for an hour.`);
  return toAdmin(path, "ok", `Email isn't working right now, so send ${target.firstName} this link yourself. It works once, for an hour.`, [{ label: "Reset link", value: r!.link }]);
}

export async function adminTempPassword(form: FormData) {
  const { me, target } = await targetFor(form);
  const path = peopleBack(form);
  if (!target) return toAdmin(path, "error", "You can't change that account here. For your own, use Account.");
  const password = target.role === "STUDENT" ? kidPassword() : tempPassword();
  await db.user.update({ where: { id: target.id }, data: { passwordHash: await hashPassword(password) } });
  await db.session.deleteMany({ where: { userId: target.id } });
  await audit(me, "password.reset", { schoolId: target.schoolId, studentId: target.role === "STUDENT" ? target.id : undefined, detail: `${target.firstName} ${target.lastName}` });
  return toAdmin(path, "ok", `New password for ${target.firstName} ${target.lastName}. They've been signed out everywhere.`, [
    ...(target.username ? [{ label: "Username", value: target.username }] : target.email ? [{ label: "Email", value: target.email }] : []),
    { label: "Password", value: password },
  ]);
}

export async function adminSetActive(form: FormData) {
  const { me, target } = await targetFor(form);
  const path = peopleBack(form);
  if (!target) return toAdmin(path, "error", "You can't change your own account here.");
  const active = form.get("active") === "true";
  await db.user.update({ where: { id: target.id }, data: { active } });
  if (!active) await db.session.deleteMany({ where: { userId: target.id } });
  await audit(me, active ? "account.reactivate" : "account.deactivate", { schoolId: target.schoolId, studentId: target.role === "STUDENT" ? target.id : undefined, detail: `${target.firstName} ${target.lastName}` });
  return toAdmin(path, "ok", `${target.firstName} ${target.lastName} is now ${active ? "active" : "deactivated"}.`);
}
