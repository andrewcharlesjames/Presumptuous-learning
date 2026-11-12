import "server-only";
import type { School } from "@prisma/client";
import { db } from "./db";

export type ConsentState = { platform: boolean | null; ai: boolean | null; platformBy?: string; aiBy?: string };

/** Latest consent per student: true = given, false = withdrawn, null = not asked yet. */
export async function consentFor(studentIds: string[]): Promise<Map<string, ConsentState>> {
  const rows = await db.consent.findMany({ where: { studentId: { in: studentIds } } });
  const out = new Map<string, ConsentState>();
  for (const id of studentIds) out.set(id, { platform: null, ai: null });
  for (const r of rows) {
    const s = out.get(r.studentId)!;
    if (r.kind === "PLATFORM") { s.platform = r.granted; s.platformBy = r.byName; }
    else { s.ai = r.granted; s.aiBy = r.byName; }
  }
  return out;
}

/** Whether AI features that send a student's own writing (tutor, project ideas) may run for this student. */
export async function aiAllowedFor(studentId: string, school: Pick<School, "aiNeedsConsent">): Promise<boolean> {
  if (!school.aiNeedsConsent) return true;
  const c = await db.consent.findUnique({ where: { studentId_kind: { studentId, kind: "AI" } } });
  return !!c?.granted;
}
