import "server-only";
import { db } from "./db";
import type { CurrentUser } from "./auth";

/** Who may see a student's record. Never across schools. */
export async function canViewStudent(viewer: CurrentUser, studentId: string): Promise<boolean> {
  const student = await db.user.findUnique({ where: { id: studentId }, select: { role: true, schoolId: true } });
  if (!student || student.role !== "STUDENT") return false;
  if (viewer.role === "PLATFORM_ADMIN") return true;
  if (viewer.schoolId !== student.schoolId) return false;
  switch (viewer.role) {
    case "SCHOOL_ADMIN": return true;
    case "STUDENT": return viewer.id === studentId;
    case "PARENT": return !!(await db.parentLink.findUnique({ where: { parentId_studentId: { parentId: viewer.id, studentId } } }));
    case "COACH": return isCoachOf(viewer.id, studentId);
  }
}

export async function isCoachOf(coachId: string, studentId: string): Promise<boolean> {
  const n = await db.classStudent.count({ where: { studentId, class: { coaches: { some: { coachId } } } } });
  return n > 0;
}

/** Staff who may manage a student (reset password, attendance). */
export async function canManageStudent(viewer: CurrentUser, studentId: string): Promise<boolean> {
  if (viewer.role === "SCHOOL_ADMIN") {
    const s = await db.user.findUnique({ where: { id: studentId }, select: { schoolId: true, role: true } });
    return !!s && s.role === "STUDENT" && s.schoolId === viewer.schoolId;
  }
  if (viewer.role === "COACH") return isCoachOf(viewer.id, studentId);
  return false;
}
