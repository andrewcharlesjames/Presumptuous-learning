"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSchoolUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { setFlash } from "@/lib/flash";
import { audit } from "@/lib/audit";

const back = (v: FormDataEntryValue | null, fallback: string) => {
  const s = String(v ?? fallback);
  return s.startsWith("/") && !s.startsWith("//") ? s : fallback;
};

async function studentInSchool(id: string, schoolId: string) {
  return db.user.findFirst({ where: { id, schoolId, role: "STUDENT" } });
}

/** A linked parent gives or withdraws consent; a school admin records consent received on paper. */
export async function setConsent(form: FormData) {
  const { user, school } = await requireSchoolUser(["PARENT", "SCHOOL_ADMIN"]);
  const studentId = String(form.get("studentId") ?? "");
  const kind = String(form.get("kind"));
  const granted = form.get("granted") === "true";
  const returnTo = back(form.get("returnTo"), "/");
  if (kind !== "PLATFORM" && kind !== "AI") redirect(returnTo);
  const student = await studentInSchool(studentId, school.id);
  const linked = user.role === "PARENT" ? await db.parentLink.findUnique({ where: { parentId_studentId: { parentId: user.id, studentId } } }) : true;
  if (!student || !linked) redirect(returnTo);
  const by = user.role === "PARENT" ? user.id : "school";
  const byName = user.role === "PARENT" ? `${user.firstName} ${user.lastName}` : `Recorded by ${user.firstName} ${user.lastName} (paper form)`;
  await db.consent.upsert({
    where: { studentId_kind: { studentId, kind } },
    create: { studentId, kind, granted, givenBy: by, byName },
    update: { granted, givenBy: by, byName },
  });
  await audit(user, "consent.change", { studentId, detail: `${kind === "AI" ? "AI features" : "Platform use"}: ${granted ? "given" : "withdrawn"}` });
  await setFlash({ tone: "ok", text: `${kind === "AI" ? "AI features" : "Platform use"}: consent ${granted ? "given" : "withdrawn"} for ${student.firstName}.` });
  revalidatePath(returnTo);
  redirect(returnTo);
}

/** A parent asks the school to delete their child's data. The school admin decides. */
export async function requestDeletion(form: FormData) {
  const { user, school } = await requireSchoolUser(["PARENT"]);
  const studentId = String(form.get("studentId") ?? "");
  const reason = String(form.get("reason") ?? "").trim().slice(0, 500);
  const link = await db.parentLink.findUnique({ where: { parentId_studentId: { parentId: user.id, studentId } }, include: { student: true } });
  if (!link) redirect("/parent");
  const open = await db.deletionRequest.findFirst({ where: { studentId, resolvedAt: null } });
  if (!open) {
    await db.deletionRequest.create({ data: { schoolId: school.id, studentId, requestedBy: user.id, byName: `${user.firstName} ${user.lastName}`, reason } });
    await audit(user, "deletion.request", { studentId, detail: reason });
  }
  await setFlash({ tone: "ok", text: `Deletion request sent to ${school.name}. The school will confirm with you.` });
  revalidatePath("/parent");
  redirect("/parent");
}

/** School admin permanently deletes a student and everything stored about them. */
export async function deleteStudentPermanently(form: FormData) {
  const { user, school } = await requireSchoolUser(["SCHOOL_ADMIN"]);
  const studentId = String(form.get("studentId") ?? "");
  const confirm = String(form.get("confirm") ?? "").trim().toLowerCase();
  const student = await studentInSchool(studentId, school.id);
  if (!student) redirect("/school/privacy");
  if (confirm !== `${student.firstName} ${student.lastName}`.toLowerCase()) {
    await setFlash({ tone: "error", text: `Type “${student.firstName} ${student.lastName}” exactly to confirm.` });
    redirect(`/students/${studentId}`);
  }
  const files = await db.artFile.findMany({ where: { studentId }, select: { id: true } });
  await db.$transaction([
    db.artwork.deleteMany({ where: { studentId } }),
    db.artFile.deleteMany({ where: { id: { in: files.map(f => f.id) } } }),
    db.attendance.deleteMany({ where: { studentId } }),
    db.tutorRequest.deleteMany({ where: { studentId } }),
    db.user.delete({ where: { id: studentId } }), // cascades: assessments, practice, skills, logs, notes, projects, consents, links, assignments
    db.deletionRequest.updateMany({ where: { studentId, resolvedAt: null }, data: { resolvedAt: new Date(), outcome: "deleted" } }),
  ]);
  await audit(user, "student.delete", { studentId, detail: `${student.firstName} ${student.lastName} (username ${student.username})` });
  await setFlash({ tone: "ok", text: `${student.firstName} ${student.lastName} and all their data have been permanently deleted.` });
  redirect("/school/privacy");
}

export async function declineDeletion(form: FormData) {
  const { user, school } = await requireSchoolUser(["SCHOOL_ADMIN"]);
  const id = String(form.get("id") ?? "");
  const note = String(form.get("note") ?? "").trim().slice(0, 300);
  const r = await db.deletionRequest.findFirst({ where: { id, schoolId: school.id, resolvedAt: null } });
  if (r) {
    await db.deletionRequest.update({ where: { id }, data: { resolvedAt: new Date(), outcome: `declined${note ? `: ${note}` : ""}` } });
    await audit(user, "deletion.decline", { studentId: r.studentId, detail: note });
  }
  redirect("/school/privacy");
}
