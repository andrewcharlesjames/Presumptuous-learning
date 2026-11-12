"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { setFlash } from "@/lib/flash";
import { isSubjectId } from "@/lib/subjects";
import { draftQuestions } from "@/lib/drafting";

const schema = z.object({
  subject: z.string().refine(isSubjectId, "Choose a subject."),
  grade: z.coerce.number().int().min(0).max(13),
  strand: z.string().trim().min(2).max(80),
  skill: z.string().trim().min(2).max(80),
  prompt: z.string().trim().min(5).max(600),
  correct: z.string().trim().min(1).max(200),
  wrong1: z.string().trim().min(1).max(200),
  wrong2: z.string().trim().min(1).max(200),
  wrong3: z.string().trim().min(1).max(200),
  explanation: z.string().trim().max(1000).default(""),
});

export async function saveQuestion(form: FormData) {
  await requireUser(["PLATFORM_ADMIN"]);
  const id = String(form.get("id") ?? "");
  const parsed = schema.safeParse(Object.fromEntries(form));
  const back = id ? `/admin/questions/${id}` : "/admin/questions/new";
  if (!parsed.success) {
    await setFlash({ tone: "error", text: parsed.error.issues[0]?.message ?? "Check every field." });
    redirect(back);
  }
  const d = parsed.data;
  const choices = [d.correct, d.wrong1, d.wrong2, d.wrong3];
  if (new Set(choices).size < 4) {
    await setFlash({ tone: "error", text: "The four answer choices must all be different." });
    redirect(back);
  }
  const reviewed = form.get("reviewed") === "on";
  const q = id
    ? await db.question.update({ where: { id }, data: { ...d, reviewed } })
    : await db.question.create({ data: { ...d, reviewed, key: `custom-${crypto.randomUUID()}`, source: "custom" } });
  await setFlash({ tone: "ok", text: id ? "Question saved." : "Question added to the bank." });
  revalidatePath("/admin/questions");
  redirect(`/admin/questions?subject=${q.subject}&grade=${q.grade}`);
}

export async function setQuestionFlag(form: FormData) {
  await requireUser(["PLATFORM_ADMIN"]);
  const id = String(form.get("id") ?? "");
  const field = String(form.get("field"));
  const value = form.get("value") === "true";
  if (field !== "active" && field !== "reviewed") redirect("/admin/questions");
  const q = await db.question.update({ where: { id }, data: { [field]: value } });
  revalidatePath("/admin/questions");
  redirect(`/admin/questions?subject=${q.subject}&grade=${q.grade}`);
}

export async function draftWithAI(form: FormData) {
  await requireUser(["PLATFORM_ADMIN"]);
  const subject = String(form.get("subject") ?? "");
  const grade = Number(form.get("grade"));
  const back = `/admin/questions?subject=${subject}&grade=${grade}`;
  if (!isSubjectId(subject) || !Number.isInteger(grade) || grade < 0 || grade > 13) redirect("/admin/questions");
  const r = await draftQuestions(subject, grade, 5);
  await setFlash(r.error
    ? { tone: "error", text: r.error }
    : { tone: "ok", text: `Drafted ${r.created} question${r.created === 1 ? "" : "s"}. They're hidden from students until you approve each one below.` });
  revalidatePath("/admin/questions");
  redirect(back);
}

export async function approveDraft(form: FormData) {
  await requireUser(["PLATFORM_ADMIN"]);
  const id = String(form.get("id") ?? "");
  const q = await db.question.update({ where: { id }, data: { active: true, source: "ai-approved" } });
  revalidatePath("/admin/questions");
  redirect(`/admin/questions?subject=${q.subject}&grade=${q.grade}`);
}

export async function deleteDraft(form: FormData) {
  await requireUser(["PLATFORM_ADMIN"]);
  const id = String(form.get("id") ?? "");
  const q = await db.question.findUnique({ where: { id } });
  if (q?.source === "ai-draft") await db.question.delete({ where: { id } });
  revalidatePath("/admin/questions");
  redirect(q ? `/admin/questions?subject=${q.subject}&grade=${q.grade}` : "/admin/questions");
}
