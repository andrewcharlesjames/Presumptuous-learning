"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSchoolUser } from "@/lib/auth";
import { newToken } from "@/lib/passwords";
import { setFlash } from "@/lib/flash";
import { audit } from "@/lib/audit";

async function classFor(classId: string) {
  const { user, school } = await requireSchoolUser(["COACH", "SCHOOL_ADMIN"]);
  const cls = await db.class.findFirst({
    where: { id: classId, schoolId: school.id, ...(user.role === "COACH" ? { coaches: { some: { coachId: user.id } } } : {}) },
    include: { students: { include: { student: true } } },
  });
  if (!cls) redirect("/coach");
  return { user, school, cls };
}

/** Makes a card for every active student in the class who doesn't have one yet. */
export async function makeCards(form: FormData) {
  const { user, school, cls } = await classFor(String(form.get("classId")));
  const missing = cls.students.map(s => s.student).filter(s => s.active && !s.cardToken);
  for (const s of missing) await db.user.update({ where: { id: s.id }, data: { cardToken: newToken() } });
  await audit(user, "card.print", { detail: `${cls.name}: ${missing.length} new`, schoolId: school.id });
  const path = `/coach/classes/${cls.id}/cards`;
  revalidatePath(path);
  redirect(path);
}

/** Replaces one student's card: the old one stops working straight away. */
export async function replaceCard(form: FormData) {
  const { user, school, cls } = await classFor(String(form.get("classId")));
  const student = cls.students.map(s => s.student).find(s => s.id === String(form.get("studentId")));
  const path = `/coach/classes/${cls.id}/cards`;
  if (!student) redirect(path);
  await db.user.update({ where: { id: student.id }, data: { cardToken: newToken() } });
  await audit(user, "card.reset", { studentId: student.id, schoolId: school.id });
  await setFlash({ tone: "ok", text: `${student.firstName}'s old card no longer works. Print the new one below.` });
  revalidatePath(path);
  redirect(path);
}
