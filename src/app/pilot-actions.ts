"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";

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
  await db.lead.create({
    data: { name: d.name, role: d.role, schoolName: d.schoolName, email: d.email.toLowerCase(), phone: d.phone, students: typeof d.students === "number" ? d.students : null, grades: d.grades, message: d.message },
  });
  redirect("/?pilot=sent#pilot");
}
