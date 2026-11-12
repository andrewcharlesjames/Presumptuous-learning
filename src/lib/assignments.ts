import "server-only";
import type { Assignment, AssignmentTarget } from "@prisma/client";
import { db } from "./db";
import { SUBJECT_BY_ID, gradeName, isSubjectId } from "./subjects";

export type AssignmentWithTargets = Assignment & { targets: AssignmentTarget[] };

export const KIND_LABEL = { MASTER_SKILL: "Learn and master", PRACTICE: "Practise", ASSESSMENT: "Retake the assessment" } as const;

export function describe(a: Pick<Assignment, "kind" | "subject" | "grade" | "skill">): string {
  if (a.kind === "ASSESSMENT") return "Retake the placement assessment";
  const subj = isSubjectId(a.subject) ? SUBJECT_BY_ID[a.subject].name(a.grade) : a.subject;
  return `${KIND_LABEL[a.kind]}: ${a.skill} (${subj}, ${gradeName(a.grade)})`;
}

/**
 * Works out completion from what students actually did — no manual ticking:
 * a mastered skill, a practice set on the skill finished after it was assigned, or an assessment completed after it was assigned.
 * Returns a map "assignmentId:studentId" → completion time.
 */
export async function completion(assignments: AssignmentWithTargets[]): Promise<Map<string, Date>> {
  const out = new Map<string, Date>();
  const studentIds = [...new Set(assignments.flatMap(a => a.targets.map(t => t.studentId)))];
  if (!studentIds.length) return out;
  const earliest = new Date(Math.min(...assignments.map(a => a.createdAt.getTime())));
  const [mastered, sessions, assessments] = await Promise.all([
    db.skillProgress.findMany({ where: { studentId: { in: studentIds }, state: "MASTERED" }, select: { studentId: true, subject: true, skill: true, masteredAt: true } }),
    db.practiceSession.findMany({ where: { studentId: { in: studentIds }, completedAt: { gte: earliest } }, select: { studentId: true, subject: true, skill: true, completedAt: true } }),
    db.assessment.findMany({ where: { studentId: { in: studentIds }, status: "COMPLETE", completedAt: { gte: earliest } }, select: { studentId: true, completedAt: true } }),
  ]);
  for (const a of assignments) {
    for (const t of a.targets) {
      let when: Date | undefined | null;
      if (a.kind === "MASTER_SKILL") when = mastered.find(m => m.studentId === t.studentId && m.subject === a.subject && m.skill === a.skill)?.masteredAt;
      else if (a.kind === "PRACTICE") when = sessions.find(s => s.studentId === t.studentId && s.subject === a.subject && s.skill === a.skill && s.completedAt! >= a.createdAt)?.completedAt;
      else when = assessments.find(x => x.studentId === t.studentId && x.completedAt! >= a.createdAt)?.completedAt;
      if (when) out.set(`${a.id}:${t.studentId}`, when);
    }
  }
  return out;
}

/** Skills in the bank by subject and grade, for the assignment picker. */
export async function skillMenu(grades: number[]): Promise<Record<string, Record<number, string[]>>> {
  const lo = Math.max(0, Math.min(...grades) - 3), hi = Math.min(13, Math.max(...grades) + 3);
  const rows = await db.question.findMany({
    where: { active: true, grade: { gte: lo, lte: hi } }, select: { subject: true, grade: true, skill: true }, orderBy: { skill: "asc" },
  });
  const menu: Record<string, Record<number, string[]>> = {};
  for (const r of rows) {
    const g = ((menu[r.subject] ??= {})[r.grade] ??= []);
    if (!g.includes(r.skill)) g.push(r.skill);
  }
  return menu;
}
