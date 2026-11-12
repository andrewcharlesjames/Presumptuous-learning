"use server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isSubjectId } from "@/lib/subjects";
import { ENT, findEntSkill } from "@/lib/presumptuous";
import { shuffle, toStoredQuestion, type BankItem } from "@/lib/assessment";
import { getOrCreateLesson, lessonCheckItems, MASTERY_SET, MAX_VARIANT } from "@/lib/lessons";
import { GENERATORS } from "@/lib/generators";
import { pickItems } from "@/lib/runner";
import { learnHref } from "@/lib/links";

function parse(form: FormData) {
  const subject = String(form.get("subject") ?? "");
  const grade = Math.max(0, Math.min(13, Number(form.get("grade"))));
  const skill = String(form.get("skill") ?? "").slice(0, 120);
  return { subject, grade, skill };
}


/** Write (or fetch) the lesson the student needs next. Called from the page while it shows a "writing your lesson" message. */
export async function prepareLesson(subject: string, grade: number, skill: string, variant: number): Promise<{ ok: boolean }> {
  const user = await requireUser(["STUDENT"]);
  if (!isSubjectId(subject) || !skill || !Number.isInteger(grade) || grade < 0 || grade > 13) return { ok: false };
  // Only real skills from the bank, near the student's grade, and only the variant they've earned.
  const ent = subject === ENT ? findEntSkill(skill) : null;
  const known = ent ? { strand: ent.unit.title } : await db.question.findFirst({ where: { subject, skill, source: { not: "lesson" } }, select: { strand: true } });
  const generated = subject === "math" && GENERATORS.some(g => g.skill === skill);
  if (!known && !generated) return { ok: false };
  if (Math.abs(grade - (user.grade ?? 0)) > 4) return { ok: false };
  const progress = await db.skillProgress.findUnique({ where: { studentId_subject_grade_skill: { studentId: user.id, subject, grade, skill } } });
  if (variant !== Math.min(MAX_VARIANT, (progress?.attempts ?? 0) + 1)) return { ok: false };
  const strand = known?.strand ?? GENERATORS.find(g => g.skill === skill)?.strand;
  const lesson = await getOrCreateLesson(subject, grade, skill, variant, strand);
  return { ok: !!lesson };
}

/** Start the 5-question mastery check that follows a lesson. */
export async function startMasteryCheck(form: FormData) {
  const user = await requireUser(["STUDENT"]);
  const { subject, grade, skill } = parse(form);
  const lessonId = String(form.get("lessonId") ?? "");
  if (!isSubjectId(subject) || !skill) redirect("/student");
  const items: BankItem[] = shuffle(lessonId ? await lessonCheckItems(lessonId) : []).slice(0, MASTERY_SET);
  if (items.length < MASTERY_SET) {
    const used = new Set(items.map(i => i.id));
    const more = (await pickItems(subject, grade, MASTERY_SET * 2, used, skill)).filter(i => i.skill === skill);
    for (const m of more) if (items.length < MASTERY_SET) items.push(m);
  }
  if (!items.length) redirect(learnHref(subject, grade, skill));
  const questions = items.map(i => toStoredQuestion(i));
  await db.skillProgress.upsert({
    where: { studentId_subject_grade_skill: { studentId: user.id, subject, grade, skill } },
    create: { studentId: user.id, subject, grade, skill }, update: {},
  });
  const s = await db.practiceSession.create({
    data: { studentId: user.id, subject, grade, skill, kind: "mastery", lessonId: lessonId || null, questions, answers: questions.map(() => null), total: questions.length },
  });
  redirect(`/student/practice/${s.id}`);
}
