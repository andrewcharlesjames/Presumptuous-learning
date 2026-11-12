import "server-only";
import type { School } from "@prisma/client";
import { db } from "./db";
import { scoreAssessment, type Answer, type StoredQuestion, type StoredResult, type Status } from "./assessment";
import type { SubjectId } from "./bank";
import { isoDate, todayIn } from "./dates";
import { familyCode, hashPassword, shortCode } from "./passwords";
import { DEFAULT_DAY, ontarioYear } from "./templates";
import { schoolYearOf } from "./dates";

/** Latest completed assessment summary for each student. */
export async function latestResults(studentIds: string[]) {
  if (!studentIds.length) return new Map<string, { completedAt: Date; grade: number; results: StoredResult[] }>();
  const rows = await db.assessment.findMany({
    where: { studentId: { in: studentIds }, status: "COMPLETE" },
    orderBy: { completedAt: "desc" },
    select: { studentId: true, completedAt: true, grade: true, results: true },
  });
  const map = new Map<string, { completedAt: Date; grade: number; results: StoredResult[] }>();
  for (const r of rows) {
    if (!map.has(r.studentId) && r.completedAt) map.set(r.studentId, { completedAt: r.completedAt, grade: r.grade, results: (r.results ?? []) as StoredResult[] });
  }
  return map;
}

/** Fully scored latest completed assessment for one student (for plans and detail views). */
export async function latestScored(studentId: string) {
  const a = await db.assessment.findFirst({ where: { studentId, status: "COMPLETE" }, orderBy: { completedAt: "desc" } });
  if (!a) return null;
  const results = scoreAssessment(a.grade, a.subjects as SubjectId[], a.questions as StoredQuestion[], a.answers as Answer[]);
  return { assessment: a, results };
}

export function countStatuses(results: StoredResult[]) {
  const c: Record<Status, number> = { below: 0, at: 0, above: 0 };
  results.forEach(r => c[r.status]++);
  return c;
}

/** Is the given date a school day, and what's on the calendar? */
export async function dayInfo(school: Pick<School, "id" | "yearStart" | "yearEnd" | "timezone">, date?: Date) {
  const d = date ?? todayIn(school.timezone);
  const events = await db.calendarEvent.findMany({
    where: { schoolId: school.id, startDate: { lte: d }, endDate: { gte: d } },
    orderBy: { startDate: "asc" },
  });
  const wd = d.getUTCDay();
  const weekend = wd === 0 || wd === 6;
  const outOfYear = d < school.yearStart || d > school.yearEnd;
  const closed = events.find(e => e.noSchool);
  const schoolDay = !weekend && !outOfYear && !closed;
  const reason = weekend ? "Weekend" : outOfYear ? "Outside the school year" : closed ? closed.title : null;
  return { date: d, iso: isoDate(d), schoolDay, reason, events };
}

export async function uniqueFamilyCode(): Promise<string> {
  for (;;) {
    const c = familyCode();
    if (!(await db.user.findUnique({ where: { familyCode: c } }))) return c;
  }
}

export async function uniqueSchoolCode(base: string): Promise<string> {
  const clean = base.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "SCHOOL";
  if (!(await db.school.findUnique({ where: { code: clean } }))) return clean;
  for (;;) {
    const c = `${clean.slice(0, 6)}${shortCode(3)}`;
    if (!(await db.school.findUnique({ where: { code: c } }))) return c;
  }
}

/** A username unique within the school, e.g. "amira.k". */
export async function uniqueUsername(schoolId: string, first: string, last: string, wanted?: string): Promise<string> {
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9.]/g, "");
  let base = norm(wanted || `${first}.${last.slice(0, 1)}`) || "student";
  if (base.length < 3) base = `${base}student`;
  let candidate = base, n = 2;
  while (await db.user.findUnique({ where: { schoolId_username: { schoolId, username: candidate } } })) candidate = `${base}${n++}`;
  return candidate;
}

/** Create a school with the default day, this year's Ontario calendar, and its first school admin. */
export async function createSchool(input: {
  name: string; code: string; admin: { firstName: string; lastName: string; email: string; password: string }; isDemo?: boolean;
}) {
  const year = ontarioYear(schoolYearOf(todayIn("America/Toronto")));
  const passwordHash = await hashPassword(input.admin.password);
  return db.school.create({
    data: {
      name: input.name,
      code: input.code,
      isDemo: input.isDemo ?? false,
      yearStart: year.yearStart,
      yearEnd: year.yearEnd,
      blocks: { create: DEFAULT_DAY.map((b, position) => ({ ...b, position })) },
      events: { create: year.events },
      users: {
        create: {
          role: "SCHOOL_ADMIN",
          email: input.admin.email.toLowerCase(),
          firstName: input.admin.firstName,
          lastName: input.admin.lastName,
          passwordHash,
        },
      },
    },
  });
}

export const fullName = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`;
