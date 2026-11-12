"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { setFlash } from "@/lib/flash";
import { tempPassword } from "@/lib/passwords";
import { createSchool, uniqueSchoolCode } from "@/lib/records";
import { createDemoSchool } from "@/lib/demo";
import { addDays, parseIsoDate, todayIn } from "@/lib/dates";
import { invoiceTotals, money, PILOT_DAYS } from "@/lib/licence";

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

export async function deleteDemoAction(form: FormData) {
  await requireUser(["PLATFORM_ADMIN"]);
  const id = String(form.get("id") ?? "");
  const school = await db.school.findUnique({ where: { id } });
  if (school?.isDemo) {
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
  const start = parseIsoDate(d.licenceStart), end = parseIsoDate(d.licenceEnd);
  if (!start || !end || end <= start) return toAdmin(path, "error", "The licence must end after it starts.");
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
      await db.invoice.create({
        data: { schoolId: id, number, dueDate: addDays(today, d.dueDays), periodStart: ps, periodEnd: pe, seats: d.seats, unitPriceCents, ...totals, notes: d.notes ?? "" },
      });
      return toAdmin(path, "ok", `Invoice ${number} created for ${money(totals.totalCents)}. The school admin can see and print it under Plan & billing.`);
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
