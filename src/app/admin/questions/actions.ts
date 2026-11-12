"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { setFlash } from "@/lib/flash";
import { isSubjectId } from "@/lib/subjects";

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
  const choices = [d.correct, d.wrong1, d.wrong2, d.wrong3].map(x => x.toLowerCase());
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
