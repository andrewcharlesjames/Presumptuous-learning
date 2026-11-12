"use server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildQuestions, scoreAssessment, toStored, type Answer, type StoredQuestion } from "@/lib/assessment";
import { subjectsForGrade, isSubjectId } from "@/lib/subjects";
import type { SubjectId } from "@/lib/bank";

/** Start a new placement assessment (or resume the one in progress). */
export async function startAssessment(form: FormData) {
  const user = await requireUser(["STUDENT"]);
  const existing = await db.assessment.findFirst({ where: { studentId: user.id, status: "IN_PROGRESS" } });
  if (existing && form.get("fresh") !== "1") redirect("/student/assessment");
  if (existing) await db.assessment.delete({ where: { id: existing.id } });
  const grade = user.grade ?? 0;
  const offered = subjectsForGrade(grade).map(s => s.id);
  const chosen = form.getAll("subject").map(String).filter(isSubjectId).filter(s => offered.includes(s));
  const subjects = (chosen.length ? chosen : offered) as SubjectId[];
  const questions = buildQuestions(grade, subjects);
  await db.assessment.create({ data: { studentId: user.id, grade, subjects, questions, answers: questions.map(() => null) } });
  redirect("/student/assessment");
}

/** Save one answer. `choice` is the position the student clicked (0–3) or -1 for "not sure yet". */
export async function saveAnswer(assessmentId: string, index: number, choice: number): Promise<{ ok: boolean }> {
  const user = await requireUser(["STUDENT"]);
  const a = await db.assessment.findFirst({ where: { id: assessmentId, studentId: user.id, status: "IN_PROGRESS" } });
  if (!a) return { ok: false };
  const questions = a.questions as StoredQuestion[];
  const answers = a.answers as Answer[];
  if (!Number.isInteger(index) || index < 0 || index >= questions.length) return { ok: false };
  if (!(choice === -1 || (Number.isInteger(choice) && choice >= 0 && choice <= 3))) return { ok: false };
  answers[index] = choice === -1 ? -1 : questions[index].order[choice];
  await db.assessment.update({ where: { id: a.id }, data: { answers } });
  return { ok: true };
}

export async function finishAssessment(assessmentId: string) {
  const user = await requireUser(["STUDENT"]);
  const a = await db.assessment.findFirst({ where: { id: assessmentId, studentId: user.id, status: "IN_PROGRESS" } });
  if (!a) redirect("/student");
  const answers = a.answers as Answer[];
  if (answers.some(x => x === null)) redirect("/student/assessment");
  const results = toStored(scoreAssessment(a.grade, a.subjects as SubjectId[], a.questions as StoredQuestion[], answers));
  await db.assessment.update({ where: { id: a.id }, data: { status: "COMPLETE", completedAt: new Date(), results } });
  redirect(`/students/${user.id}?done=1`);
}
