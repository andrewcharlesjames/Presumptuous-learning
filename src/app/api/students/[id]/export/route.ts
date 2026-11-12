import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * Everything stored about one student, as JSON. Available to the student's linked parents and their school's admins.
 * Uploaded files are listed by name and type; they can be opened from the portfolio.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getUser();
  if (!viewer) return new Response("Sign in first.", { status: 401 });
  const student = await db.user.findUnique({ where: { id }, include: { school: true } });
  if (!student || student.role !== "STUDENT") return new Response("Not found", { status: 404 });
  const isAdmin = (viewer.role === "SCHOOL_ADMIN" && viewer.schoolId === student.schoolId) || viewer.role === "PLATFORM_ADMIN";
  const isParent = viewer.role === "PARENT" && !!(await db.parentLink.findUnique({ where: { parentId_studentId: { parentId: viewer.id, studentId: id } } }));
  if (!isAdmin && !isParent) return new Response("Not found", { status: 404 });

  const [classes, parents, assessments, practice, skills, logs, attendance, assignments, notes, artworks, projects, consents] = await Promise.all([
    db.classStudent.findMany({ where: { studentId: id }, include: { class: { select: { name: true, grades: true } } } }),
    db.parentLink.findMany({ where: { studentId: id }, include: { parent: { select: { firstName: true, lastName: true, email: true } } } }),
    db.assessment.findMany({ where: { studentId: id }, select: { grade: true, subjects: true, mode: true, status: true, results: true, questions: true, answers: true, startedAt: true, completedAt: true } }),
    db.practiceSession.findMany({ where: { studentId: id }, select: { subject: true, grade: true, skill: true, kind: true, correct: true, total: true, startedAt: true, completedAt: true } }),
    db.skillProgress.findMany({ where: { studentId: id }, select: { subject: true, grade: true, skill: true, state: true, attempts: true, lastScore: true, lastTotal: true, masteredAt: true } }),
    db.dailyLog.findMany({ where: { studentId: id }, select: { date: true, mood: true, goal: true, learned: true, question: true, effort: true, artsDone: true, lifeDone: true, checkedInAt: true, reflectedAt: true } }),
    db.attendance.findMany({ where: { studentId: id }, select: { date: true, status: true, note: true } }),
    db.assignment.findMany({ where: { targets: { some: { studentId: id } } }, select: { kind: true, subject: true, grade: true, skill: true, note: true, dueDate: true, createdAt: true } }),
    db.coachNote.findMany({ where: { studentId: id, ...(isAdmin ? {} : { shared: true }) }, select: { body: true, shared: true, createdAt: true, author: { select: { firstName: true, lastName: true } } } }),
    db.artwork.findMany({ where: { studentId: id }, select: { title: true, discipline: true, reflection: true, prompt: true, textBody: true, featured: true, createdAt: true, file: { select: { mime: true, size: true } }, feedback: { select: { body: true, createdAt: true } } } }),
    db.project.findMany({ where: { studentId: id }, include: { milestones: { select: { title: true, status: true, dueDate: true, evidence: true, link: true, feedback: true, submittedAt: true } } } }),
    db.consent.findMany({ where: { studentId: id }, select: { kind: true, granted: true, byName: true, updatedAt: true } }),
  ]);
  await audit(viewer, "student.export", { studentId: id, schoolId: student.schoolId });
  const body = {
    exportedAt: new Date().toISOString(),
    school: student.school?.name,
    student: { firstName: student.firstName, lastName: student.lastName, grade: student.grade, username: student.username, createdAt: student.createdAt },
    classes: classes.map(c => c.class), parents: parents.map(p => p.parent),
    consents, assessments, practice, skills, dailyLogs: logs, attendance, assignments, notes, artworks, projects,
  };
  const name = `${student.firstName}-${student.lastName}-data.json`.replace(/[^A-Za-z0-9.-]/g, "_");
  return new Response(JSON.stringify(body, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
}
