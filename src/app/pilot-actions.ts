"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { appUrl, sendEmail } from "@/lib/email";

const leadSchema = z.object({
  name: z.string().trim().min(2).max(120),
  role: z.string().trim().max(80).default(""),
  schoolName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).default(""),
  students: z.union([z.literal(""), z.coerce.number().int().min(1).max(100000)]).optional(),
  grades: z.string().trim().max(60).default(""),
  message: z.string().trim().max(2000).default(""),
});

// Per-instance limit: 5 requests per address per hour.
const recent = new Map<string, number[]>();

/** The public "Request a pilot" form on the home page. */
export async function requestPilot(form: FormData) {
  if (String(form.get("website") ?? "")) redirect("/?pilot=sent#pilot"); // honeypot: bots fill every field
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter(t => now - t < 3600_000);
  if (hits.length >= 5) redirect("/?pilot=busy#pilot");
  const p = leadSchema.safeParse(Object.fromEntries(form));
  if (!p.success) redirect("/?pilot=error#pilot");
  recent.set(ip, [...hits, now]);
  const d = p.data;
  const lead = await db.lead.create({
    data: { name: d.name, role: d.role, schoolName: d.schoolName, email: d.email.toLowerCase(), phone: d.phone, students: typeof d.students === "number" ? d.students : null, grades: d.grades, message: d.message },
  });
  const to = process.env.SALES_EMAIL || process.env.ADMIN_EMAIL;
  if (to) await sendEmail({
    kind: "pilot_alert", to, subject: `Pilot request: ${lead.schoolName}`, heading: `New pilot request from ${lead.schoolName}`,
    paragraphs: [`${lead.name}${lead.role ? `, ${lead.role}` : ""} · ${lead.email}${lead.phone ? ` · ${lead.phone}` : ""}`, `${lead.students ? `About ${lead.students} students` : "Students not given"}${lead.grades ? ` · Grades ${lead.grades}` : ""}`, ...(lead.message ? [lead.message] : [])],
    button: { label: "Open pilot requests", href: `${appUrl()}/admin/leads` },
  });
  redirect("/?pilot=sent#pilot");
}
