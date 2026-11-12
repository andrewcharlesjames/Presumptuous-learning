"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSchoolUser } from "@/lib/auth";
import { canManageStudent } from "@/lib/access";
import { db } from "@/lib/db";
import { setFlash } from "@/lib/flash";
import { isSubjectId } from "@/lib/subjects";
import { parseIsoDate } from "@/lib/dates";

const staff = () => requireSchoolUser(["COACH", "SCHOOL_ADMIN"]);
const safeReturn = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "/coach");
  return s.startsWith("/") && !s.startsWith("//") ? s : "/coach";
};

/** Assign work to one or more students. Coaches can assign only to students in their classes. */
export async function createAssignment(form: FormData) {
  const { user, school } = await staff();
  const returnTo = safeReturn(form.get("returnTo"));
  const kind = String(form.get("kind"));
  const subject = String(form.get("subject") ?? "");
  const grade = Number(form.get("grade"));
  const skill = String(form.get("skill") ?? "").trim().slice(0, 120);
  const note = String(form.get("note") ?? "").trim().slice(0, 300);
  const dueRaw = String(form.get("dueDate") ?? "");
  const dueDate = dueRaw ? parseIsoDate(dueRaw) : null;
  const requested = [...new Set(form.getAll("student").map(String))];
  const fail = async (text: string) => { await setFlash({ tone: "error", text }); redirect(returnTo); };

  if (!["MASTER_SKILL", "PRACTICE", "ASSESSMENT"].includes(kind)) return fail("Choose what to assign.");
  if (kind !== "ASSESSMENT" && (!isSubjectId(subject) || !skill || !Number.isInteger(grade) || grade < 0 || grade > 13)) return fail("Choose a subject, grade and skill.");
  if (dueRaw && !dueDate) return fail("That due date isn't valid.");
  const allowed: string[] = [];
  for (const id of requested) if (await canManageStudent(user, id)) allowed.push(id);
  if (!allowed.length) return fail("Choose at least one of your students.");

  await db.assignment.create({
    data: {
      schoolId: school.id, createdById: user.id, kind: kind as "MASTER_SKILL" | "PRACTICE" | "ASSESSMENT",
      subject: kind === "ASSESSMENT" ? "" : subject, grade: kind === "ASSESSMENT" ? 0 : grade, skill: kind === "ASSESSMENT" ? "" : skill,
      note, dueDate, targets: { create: allowed.map(studentId => ({ studentId })) },
    },
  });
  await setFlash({ tone: "ok", text: `Assigned to ${allowed.length} student${allowed.length === 1 ? "" : "s"}. They'll see it at the top of their Today screen.` });
  revalidatePath(returnTo);
  redirect(returnTo);
}

export async function deleteAssignment(form: FormData) {
  const { user, school } = await staff();
  const returnTo = safeReturn(form.get("returnTo"));
  const id = String(form.get("id") ?? "");
  const a = await db.assignment.findFirst({ where: { id, schoolId: school.id } });
  if (a && (a.createdById === user.id || user.role === "SCHOOL_ADMIN")) {
    await db.assignment.delete({ where: { id } });
    await setFlash({ tone: "ok", text: "Assignment removed." });
  }
  revalidatePath(returnTo);
  redirect(returnTo);
}

export async function addNote(form: FormData) {
  const { user } = await staff();
  const studentId = String(form.get("studentId") ?? "");
  const body = String(form.get("body") ?? "").trim().slice(0, 2000);
  const shared = form.get("shared") === "on";
  const returnTo = `/students/${studentId}`;
  if (!body || !(await canManageStudent(user, studentId))) { await setFlash({ tone: "error", text: "Write a note first." }); redirect(returnTo); }
  await db.coachNote.create({ data: { studentId, authorId: user.id, body, shared } });
  await setFlash({ tone: "ok", text: shared ? "Note saved and shared with the student and family." : "Note saved for staff only." });
  revalidatePath(returnTo);
  redirect(returnTo);
}

export async function deleteNote(form: FormData) {
  const { user } = await staff();
  const id = String(form.get("id") ?? "");
  const n = await db.coachNote.findUnique({ where: { id } });
  if (n && (n.authorId === user.id || (user.role === "SCHOOL_ADMIN" && await canManageStudent(user, n.studentId)))) await db.coachNote.delete({ where: { id } });
  const returnTo = n ? `/students/${n.studentId}` : "/coach";
  revalidatePath(returnTo);
  redirect(returnTo);
}
