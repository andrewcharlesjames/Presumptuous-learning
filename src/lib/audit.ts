import "server-only";
import { headers } from "next/headers";
import { db } from "./db";

export const AUDIT_LABEL: Record<string, string> = {
  "student.view": "Viewed student record",
  "student.portfolio": "Viewed portfolio",
  "student.projects": "Viewed projects",
  "student.export": "Downloaded student data",
  "student.delete": "Deleted student and all data",
  "student.grade": "Changed grade",
  "password.reset": "Reset password",
  "account.deactivate": "Deactivated account",
  "account.reactivate": "Reactivated account",
  "consent.change": "Changed consent",
  "deletion.request": "Requested data deletion",
  "deletion.decline": "Declined deletion request",
  "settings.change": "Changed school settings",
  "staff.add": "Added staff account",
  "student.add": "Added student",
  "student.import": "Imported students",
  "password.link": "Sent a password reset link",
  "password.self_reset": "Reset own password by email",
  "account.link": "Connected a Google or Microsoft account",
  "account.unlink": "Disconnected a Google or Microsoft account",
  "card.print": "Printed student sign-in cards",
  "card.reset": "Replaced a student's sign-in card",
  "report.final": "Released a report card",
  "report.reopen": "Reopened a report card",
};

type Actor = { id: string; firstName: string; lastName: string; role: string; schoolId: string | null };

/** Record who did what. Never throws: an audit failure must not block the person's work. */
export async function audit(actor: Actor, action: string, opts: { studentId?: string; detail?: string; schoolId?: string | null } = {}) {
  try {
    const h = await headers();
    const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim().slice(0, 64);
    await db.auditEvent.create({
      data: {
        schoolId: opts.schoolId ?? actor.schoolId, actorId: actor.id, actorName: `${actor.firstName} ${actor.lastName}`, actorRole: actor.role,
        action, studentId: opts.studentId, detail: (opts.detail ?? "").slice(0, 500), ip,
      },
    });
  } catch (e) {
    console.error("audit failed", e);
  }
}

/** Log a view of a student's records by anyone other than the student. */
export async function auditView(actor: Actor, studentId: string, action: "student.view" | "student.portfolio" | "student.projects") {
  if (actor.id !== studentId) await audit(actor, action, { studentId });
}
