"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSchoolUser } from "@/lib/auth";
import { canManageStudent } from "@/lib/access";
import { setFlash } from "@/lib/flash";
import { audit } from "@/lib/audit";
import { RATINGS, SKILLS, isTerm, type SkillRatings } from "@/lib/report-rules";
import { reportFacts, yearOf } from "@/lib/reports";

/** Save a report as a draft, release it to the family, or reopen a released one. */
export async function saveReport(form: FormData) {
  const { user, school } = await requireSchoolUser(["COACH", "SCHOOL_ADMIN"]);
  const studentId = String(form.get("studentId") ?? "");
  const term = Number(form.get("term"));
  const intent = String(form.get("intent") ?? "draft");
  if (!isTerm(term) || !(await canManageStudent(user, studentId))) redirect("/coach");
  const schoolYear = yearOf(school);
  const path = `/students/${studentId}/report/edit?term=${term}`;
  const student = await db.user.findUnique({ where: { id: studentId } });
  if (!student) redirect("/coach");
  const where = { studentId_schoolYear_term: { studentId, schoolYear, term } };

  if (intent === "reopen") {
    await db.reportCard.update({ where, data: { status: "DRAFT", finalizedAt: null, updatedById: user.id } });
    await audit(user, "report.reopen", { studentId, detail: `Term ${term}` });
    await setFlash({ tone: "ok", text: `Reopened. ${student.firstName}'s family can't see this report until you release it again.` });
    revalidatePath(path);
    redirect(path);
  }
  const existing = await db.reportCard.findUnique({ where });
  if (existing?.status === "FINAL") redirect(path); // reopen first

  const learningSkills: SkillRatings = {};
  for (const s of SKILLS) { const v = String(form.get(`skill_${s.key}`) ?? ""); if (v in RATINGS) learningSkills[s.key] = v as keyof typeof RATINGS; }
  const comments: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (k.startsWith("comment_")) comments[k.slice(8)] = String(v).trim().slice(0, 2000);
  const general = String(form.get("general") ?? "").trim().slice(0, 3000);
  const nextSteps = String(form.get("nextSteps") ?? "").trim().slice(0, 2000);
  const final = intent === "final";
  const facts = await reportFacts(school, student, schoolYear, term);
  const ev = facts.evidence;
  const snapshot = {
    subjects: facts.subjects.map(x => ({ sid: x.sid, name: x.name, mark: x.mark, level: x.level })),
    attendance: { present: ev.present, late: ev.late, absent: Math.max(0, ev.schoolDays - ev.present - ev.late) },
    assessedAt: facts.assessedAt?.toISOString() ?? null,
  };
  if (final) {
    const missing = SKILLS.filter(s => !learningSkills[s.key]).map(s => s.name);
    const empty = Object.entries(comments).filter(([, v]) => !v).length;
    if (missing.length || empty) {
      await db.reportCard.upsert({ where, create: { schoolId: school.id, studentId, schoolYear, term, learningSkills, comments, general, nextSteps, snapshot, updatedById: user.id }, update: { learningSkills, comments, general, nextSteps, snapshot, updatedById: user.id } });
      await setFlash({ tone: "error", text: `Saved as a draft, not released yet. ${missing.length ? `Rate ${missing.join(", ")}. ` : ""}${empty ? `Fill in ${empty} empty subject comment${empty === 1 ? "" : "s"}.` : ""}` });
      revalidatePath(path);
      redirect(path);
    }
  }
  const data = { learningSkills, comments, general, nextSteps, snapshot, updatedById: user.id, status: final ? "FINAL" as const : "DRAFT" as const, finalizedAt: final ? new Date() : null };
  await db.reportCard.upsert({ where, create: { schoolId: school.id, studentId, schoolYear, term, ...data }, update: data });
  if (final) await audit(user, "report.final", { studentId, detail: `Term ${term}` });
  await setFlash({ tone: "ok", text: final ? `Released. ${student.firstName} and their family can now see and print this report.` : "Draft saved. Only staff can see it." });
  revalidatePath(path);
  redirect(final ? `/students/${studentId}/report?term=${term}` : path);
}
