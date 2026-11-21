"use server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { scoreAssessment, toStored, type Answer, type StoredQuestion } from "@/lib/assessment";
import { subjectsForGrade, isSubjectId } from "@/lib/subjects";
import type { SubjectId } from "@/lib/bank";
import { lookupFor } from "@/lib/questions";
import { advance, currentView } from "@/lib/runner";

/** Start a new adaptive placement assessment (or resume the one in progress). */
export async function startAssessment(form: FormData) {
  const user = await requireUser(["STUDENT"]);
  const existing = await db.assessment.findFirst({ where: { studentId: user.id, status: "IN_PROGRESS" } });
  if (existing && existing.mode === "adaptive" && form.get("fresh") !== "1") redirect("/student/assessment");
  if (existing) await db.assessment.delete({ where: { id: existing.id } });
  const grade = user.grade ?? 0;
  const offered = subjectsForGrade(grade).map(s => s.id);
  const chosen = form.getAll("subject").map(String).filter(isSubjectId).filter(s => offered.includes(s));
  const subjects = (chosen.length ? chosen : offered) as SubjectId[];
  const a = await db.assessment.create({ data: { studentId: user.id, grade, subjects, mode: "adaptive", questions: [], answers: [] } });
  await advance(a);
  redirect("/student/assessment");
}

/** Start the monthly check-up: the placement assessment again, each subject starting at its last working level. */
export async function startCheckup() {
  const user = await requireUser(["STUDENT"]);
  const existing = await db.assessment.findFirst({ where: { studentId: user.id, status: "IN_PROGRESS" } });
  if (existing?.kind === "checkup") redirect("/student/assessment");
  if (existing) await db.assessment.delete({ where: { id: existing.id } });
  const last = await db.assessment.findFirst({ where: { studentId: user.id, status: "COMPLETE" }, orderBy: { completedAt: "desc" } });
  const grade = user.grade ?? 0;
  const subjects = subjectsForGrade(grade).map(s => s.id) as SubjectId[];
  const startAt: Partial<Record<SubjectId, number>> = {};
  for (const r of ((last?.results ?? []) as { sid: SubjectId; working?: number }[])) {
    if (typeof r.working === "number") startAt[r.sid] = Math.max(0, Math.min(13, r.working));
  }
  const a = await db.assessment.create({ data: { studentId: user.id, grade, subjects, mode: "adaptive", kind: "checkup", startAt, questions: [], answers: [] } });
  await advance(a);
  redirect("/student/assessment");
}

async function finish(id: string, studentId: string) {
  const a = await db.assessment.findFirst({ where: { id, studentId, status: "IN_PROGRESS" } });
  if (!a) return;
  const questions = a.questions as StoredQuestion[];
  const lookup = await lookupFor(questions);
  const results = toStored(scoreAssessment(a.grade, a.subjects as SubjectId[], questions, a.answers as Answer[], lookup, "adaptive", (a.startAt ?? {}) as Partial<Record<SubjectId, number>>));
  await db.assessment.update({ where: { id }, data: { status: "COMPLETE", completedAt: new Date(), results } });
}

export type NextView = Awaited<ReturnType<typeof currentView>>;

/**
 * Save the answer to the current question and return the next one.
 * `choice` is the position the student picked (0–3) or -1 for "not sure yet".
 */
export async function submitAnswer(assessmentId: string, index: number, choice: number): Promise<{ ok: boolean; done?: boolean; next?: NextView }> {
  const user = await requireUser(["STUDENT"]);
  const a = await db.assessment.findFirst({ where: { id: assessmentId, studentId: user.id, status: "IN_PROGRESS" } });
  if (!a) return { ok: false };
  const questions = a.questions as StoredQuestion[];
  const answers = a.answers as Answer[];
  if (answers[index] !== null || answers.findIndex(x => x === null) !== index) return { ok: false };
  if (!(choice === -1 || (Number.isInteger(choice) && choice >= 0 && choice <= 3))) return { ok: false };
  answers[index] = choice === -1 ? -1 : questions[index].order[choice];
  await db.assessment.update({ where: { id: a.id }, data: { answers } });
  const step = await advance({ ...a, questions, answers });
  if (step.done) {
    await finish(a.id, user.id);
    return { ok: true, done: true };
  }
  return { ok: true, next: await currentView(a, step.questions, step.answers) };
}
