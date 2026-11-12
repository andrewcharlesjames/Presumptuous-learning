"use server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isSubjectId } from "@/lib/subjects";
import { toStoredQuestion, type Answer, type StoredQuestion } from "@/lib/assessment";
import { lookupFor } from "@/lib/questions";
import { pickItems } from "@/lib/runner";

const SET_SIZE = 5;

/** Start a 5-question practice set for one subject and skill at a grade level. */
export async function startPractice(form: FormData) {
  const user = await requireUser(["STUDENT"]);
  const sid = String(form.get("subject") ?? "");
  const skill = String(form.get("skill") ?? "").slice(0, 120);
  const grade = Math.max(0, Math.min(13, Number(form.get("grade")) || (user.grade ?? 0)));
  if (!isSubjectId(sid)) redirect("/student");
  const used = new Set<string>();
  const items = await pickItems(sid, grade, SET_SIZE, used, skill || undefined);
  items.forEach(i => used.add(i.id));
  // top up from neighbouring grades if this grade has too few questions
  for (const p of [grade - 1, grade + 1, grade - 2]) {
    if (items.length >= SET_SIZE || p < 0 || p > 13) continue;
    const more = await pickItems(sid, p, SET_SIZE - items.length, used, skill || undefined);
    more.forEach(i => { used.add(i.id); items.push(i); });
  }
  if (!items.length) redirect("/student");
  const questions = items.map(i => toStoredQuestion(i));
  const s = await db.practiceSession.create({
    data: { studentId: user.id, subject: sid, grade, skill, questions, answers: questions.map(() => null), total: questions.length },
  });
  redirect(`/student/practice/${s.id}`);
}

export type Feedback = { ok: boolean; correctText: string; explanation: string; done: boolean; score?: { correct: number; total: number } };

/** Check one practice answer and give feedback straight away. */
export async function answerPractice(sessionId: string, index: number, choice: number): Promise<Feedback | null> {
  const user = await requireUser(["STUDENT"]);
  const s = await db.practiceSession.findFirst({ where: { id: sessionId, studentId: user.id } });
  if (!s || s.completedAt) return null;
  const questions = s.questions as StoredQuestion[];
  const answers = s.answers as Answer[];
  if (index < 0 || index >= questions.length || answers[index] !== null) return null;
  if (!(choice === -1 || (Number.isInteger(choice) && choice >= 0 && choice <= 3))) return null;
  const q = questions[index];
  answers[index] = choice === -1 ? -1 : q.order[choice];
  const item = (await lookupFor([q]))(q);
  const done = answers.every(a => a !== null);
  const correct = answers.filter(a => a === 0).length;
  await db.practiceSession.update({ where: { id: s.id }, data: { answers, correct, ...(done ? { completedAt: new Date() } : {}) } });
  return {
    ok: answers[index] === 0,
    correctText: item?.choices[0] ?? "",
    explanation: item?.explanation ?? "",
    done,
    ...(done ? { score: { correct, total: questions.length } } : {}),
  };
}
