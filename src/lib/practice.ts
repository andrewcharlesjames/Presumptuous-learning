import "server-only";
import { db } from "./db";
import { addDays } from "./dates";

export type PracticeSummary = { sets: number; questions: number; correct: number; minutes: number; bySubject: Map<string, { sets: number; correct: number; questions: number }> };

/** Completed practice in the last `days` days, per student. */
export async function practiceSummary(studentIds: string[], days = 7): Promise<Map<string, PracticeSummary>> {
  const out = new Map<string, PracticeSummary>();
  if (!studentIds.length) return out;
  const rows = await db.practiceSession.findMany({
    where: { studentId: { in: studentIds }, completedAt: { gte: addDays(new Date(), -days) } },
    select: { studentId: true, subject: true, correct: true, total: true, startedAt: true, completedAt: true },
  });
  for (const r of rows) {
    const s = out.get(r.studentId) ?? { sets: 0, questions: 0, correct: 0, minutes: 0, bySubject: new Map() };
    s.sets++; s.questions += r.total; s.correct += r.correct;
    s.minutes += Math.min(30, Math.max(1, Math.round((+r.completedAt! - +r.startedAt) / 60000)));
    const b = s.bySubject.get(r.subject) ?? { sets: 0, correct: 0, questions: 0 };
    b.sets++; b.correct += r.correct; b.questions += r.total;
    s.bySubject.set(r.subject, b);
    out.set(r.studentId, s);
  }
  return out;
}
