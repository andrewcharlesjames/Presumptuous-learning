import "server-only";
import type { School } from "@prisma/client";
import { db } from "./db";
import { utcDate, schoolYearOf, todayIn } from "./dates";
import { dayBounds, dayStatuses } from "./schoolday";
import { completion } from "./assignments";
import { latestScored, masteredSet } from "./records";
import { nextLevelSkills } from "./plan";
import { gradeName } from "./subjects";
import { draftComment, markFor, suggestSkills, type Evidence, type SkillRatings, type Term } from "./report-rules";

/** The calendar window a term reports on. */
export function termRange(school: Pick<School, "yearStart" | "yearEnd">, schoolYear: number, term: Term): { from: Date; to: Date } {
  const y = schoolYear;
  if (term === 0) return { from: school.yearStart, to: utcDate(y, 10, 30) };
  if (term === 1) return { from: utcDate(y, 11, 1), to: new Date(utcDate(y + 1, 2, 1).getTime() - 86400000) };
  return { from: utcDate(y + 1, 2, 1), to: school.yearEnd };
}

/** What the platform saw from `from` (or the day the student joined, if later) to `to` (or today). */
export async function evidence(school: School, studentId: string, termFrom: Date, to: Date, joined?: Date): Promise<Evidence> {
  const today = todayIn(school.timezone);
  const end = to < today ? to : today;
  const joinDay = joined ? todayIn(school.timezone, joined) : termFrom;
  const from = joinDay > termFrom ? joinDay : termFrom;
  if (end < from) return { schoolDays: 0, present: 0, late: 0, absent: 0, completeDays: 0, reflections: 0, practiceSets: 0, assignmentsDue: 0, assignmentsDone: 0, projectStepsApproved: 0, projectStepsDue: 0, masteredSkills: 0 };
  const a = dayBounds(from, school.timezone).start, b = dayBounds(end, school.timezone).end;
  const [statuses, att, practice, assignments, steps, mastered] = await Promise.all([
    dayStatuses(school, [studentId], from, end),
    db.attendance.groupBy({ by: ["status"], where: { studentId, date: { gte: from, lte: end } }, _count: true }),
    db.practiceSession.count({ where: { studentId, completedAt: { gte: a, lt: b } } }),
    db.assignment.findMany({ where: { targets: { some: { studentId } }, dueDate: { gte: from, lte: end } }, include: { targets: { where: { studentId } } } }),
    db.projectMilestone.findMany({ where: { project: { studentId }, dueDate: { gte: from, lte: end } }, select: { status: true } }),
    db.skillProgress.count({ where: { studentId, state: "MASTERED", masteredAt: { gte: a, lt: b } } }),
  ]);
  const days = (statuses.get(studentId) ?? []).filter(d => d.schoolDay);
  const done = await completion(assignments);
  const count = (s: string) => att.find(x => x.status === s)?._count ?? 0;
  return {
    schoolDays: days.length, present: count("PRESENT"), late: count("LATE"), absent: count("ABSENT"),
    completeDays: days.filter(d => d.complete).length, reflections: days.filter(d => d.reflected).length,
    practiceSets: practice, assignmentsDue: assignments.length, assignmentsDone: assignments.filter(x => done.has(`${x.id}:${studentId}`)).length,
    projectStepsApproved: steps.filter(s => s.status === "APPROVED").length, projectStepsDue: steps.length, masteredSkills: mastered,
  };
}

export type ReportSubject = { sid: string; name: string; level: 1 | 2 | 3 | 4; status: "below" | "at" | "above"; working: string; mark: string; draft: string };

/** Everything a report shows that comes from the platform: subject marks, comment drafts and suggested learning skills. */
export async function reportFacts(school: School, student: { id: string; firstName: string; grade: number | null; createdAt: Date }, schoolYear: number, term: Term) {
  const grade = student.grade ?? 0;
  const [scored, mastered] = await Promise.all([latestScored(student.id), masteredSet(student.id)]);
  const { from, to } = termRange(school, schoolYear, term);
  const ev = await evidence(school, student.id, from, to, student.createdAt);
  const masteredRows = await db.skillProgress.findMany({ where: { studentId: student.id, state: "MASTERED" }, orderBy: { masteredAt: "desc" }, select: { subject: true, skill: true } });
  const subjects: ReportSubject[] = (scored?.results ?? []).map(r => {
    const next = nextLevelSkills(r, scored!.assessment.grade, scored!.skillsAt).filter(q => !mastered.has(`${r.sid}|${q.skill}`)).map(q => q.skill);
    const working = r.working < 0 ? "pre-Kindergarten" : gradeName(r.working);
    return {
      sid: r.sid, name: r.name, level: r.level, status: r.status, working, mark: markFor(term, grade, r.level, r.status),
      draft: draftComment({ first: student.firstName, subject: r.name, status: r.status, workingGrade: working, mastered: masteredRows.filter(m => m.subject === r.sid).map(m => m.skill), next }),
    };
  });
  return { subjects, evidence: ev, suggested: suggestSkills(ev) as SkillRatings, assessedAt: scored?.assessment.completedAt ?? null, from, to };
}

export const yearOf = (school: Pick<School, "timezone">) => schoolYearOf(todayIn(school.timezone));

export type Snapshot = { subjects: { sid: string; name: string; mark: string; level: number }[]; attendance: { present: number; late: number; absent: number }; assessedAt: string | null };
