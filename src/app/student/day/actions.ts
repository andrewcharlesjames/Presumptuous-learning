"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSchoolUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { todayIn } from "@/lib/dates";

async function today() {
  const { user, school } = await requireSchoolUser(["STUDENT"]);
  return { user, date: todayIn(school.timezone) };
}
const done = () => { revalidatePath("/student"); redirect("/student"); };

export async function checkIn(form: FormData) {
  const { user, date } = await today();
  const mood = Number(form.get("mood"));
  const goal = String(form.get("goal") ?? "").trim().slice(0, 200);
  if (!(mood >= 1 && mood <= 5)) return done();
  await db.dailyLog.upsert({
    where: { studentId_date: { studentId: user.id, date } },
    create: { studentId: user.id, date, mood, goal, checkedInAt: new Date() },
    update: { mood, goal, checkedInAt: new Date() },
  });
  done();
}

export async function reflect(form: FormData) {
  const { user, date } = await today();
  const learned = String(form.get("learned") ?? "").trim().slice(0, 500);
  const question = String(form.get("question") ?? "").trim().slice(0, 300);
  const effort = Number(form.get("effort"));
  if (!learned) return done();
  await db.dailyLog.upsert({
    where: { studentId_date: { studentId: user.id, date } },
    create: { studentId: user.id, date, learned, question, effort: effort >= 1 && effort <= 4 ? effort : null, reflectedAt: new Date() },
    update: { learned, question, effort: effort >= 1 && effort <= 4 ? effort : null, reflectedAt: new Date() },
  });
  done();
}

export async function markPromptDone(form: FormData) {
  const { user, date } = await today();
  const kind = String(form.get("kind"));
  if (kind !== "arts" && kind !== "life") return done();
  const field = kind === "arts" ? { artsDone: true } : { lifeDone: true };
  await db.dailyLog.upsert({
    where: { studentId_date: { studentId: user.id, date } },
    create: { studentId: user.id, date, ...field },
    update: field,
  });
  done();
}
