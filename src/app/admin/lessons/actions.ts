"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { setFlash } from "@/lib/flash";

export async function setLessonFlag(form: FormData) {
  await requireUser(["PLATFORM_ADMIN"]);
  const id = String(form.get("id") ?? "");
  const field = String(form.get("field"));
  const value = form.get("value") === "true";
  if (field !== "reviewed" && field !== "active") redirect("/admin/lessons");
  await db.lesson.update({ where: { id }, data: { [field]: value } });
  await setFlash({ tone: "ok", text: field === "active" && !value ? "Lesson retired. A new one will be written the next time a student needs this skill." : "Saved." });
  revalidatePath("/admin/lessons");
  redirect(`/admin/lessons/${id}`);
}
