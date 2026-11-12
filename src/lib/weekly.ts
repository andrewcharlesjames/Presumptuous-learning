import "server-only";
import { db } from "./db";
import { clockIn, fmtDate, isoDate, mondayOf, todayIn } from "./dates";
import { dayBounds, dayStatuses, streaks } from "./schoolday";
import { completion, describe } from "./assignments";
import { appUrl, sendEmail, type Email } from "./email";
import { newToken } from "./passwords";
import { SUBJECT_BY_ID, isSubjectId } from "./subjects";
import { PROJECT_LABEL } from "./projects";

const SEND_DAY = 5; // Friday
const SEND_FROM = "16:00"; // local school time

type ChildWeek = {
  name: string; schoolDays: number; complete: number; streak: number;
  mastered: string[]; practiceSets: number; practicePct: number | null;
  steps: string[]; open: string[]; notes: string[]; planUrl: string;
};

/** One child's week, Monday to today, in the school's time zone. */
async function childWeek(student: { id: string; firstName: string; grade: number | null }, school: { id: string; timezone: string; yearStart: Date; yearEnd: Date }, today: Date): Promise<ChildWeek> {
  const monday = mondayOf(today);
  const from = dayBounds(monday, school.timezone).start, to = dayBounds(today, school.timezone).end;
  const [statuses, streak, mastered, practice, steps, notes, assignments] = await Promise.all([
    dayStatuses(school, [student.id], monday, today),
    streaks(school, [student.id]),
    db.skillProgress.findMany({ where: { studentId: student.id, state: "MASTERED", masteredAt: { gte: from, lt: to } }, select: { subject: true, skill: true } }),
    db.practiceSession.findMany({ where: { studentId: student.id, completedAt: { gte: from, lt: to } }, select: { correct: true, total: true } }),
    db.projectMilestone.findMany({ where: { project: { studentId: student.id }, status: "APPROVED", reviewedAt: { gte: from, lt: to } }, include: { project: { select: { type: true } } } }),
    db.coachNote.findMany({ where: { studentId: student.id, shared: true, createdAt: { gte: from, lt: to } }, include: { author: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "asc" } }),
    db.assignment.findMany({ where: { targets: { some: { studentId: student.id } } }, include: { targets: { where: { studentId: student.id } } }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  const done = await completion(assignments);
  const days = (statuses.get(student.id) ?? []).filter(d => d.schoolDay);
  const q = practice.reduce((a, p) => a + p.total, 0), c = practice.reduce((a, p) => a + p.correct, 0);
  const subj = (s: string) => (isSubjectId(s) ? SUBJECT_BY_ID[s].name(student.grade ?? 0) : s);
  return {
    name: student.firstName, schoolDays: days.length, complete: days.filter(d => d.complete).length, streak: streak.get(student.id)?.current ?? 0,
    mastered: mastered.map(m => `${m.skill} (${subj(m.subject)})`),
    practiceSets: practice.length, practicePct: q ? Math.round((c / q) * 100) : null,
    steps: steps.map(s => `${PROJECT_LABEL[s.project.type]}: ${s.title}`),
    open: assignments.filter(a => !done.has(`${a.id}:${student.id}`)).map(a => `${describe(a)}${a.dueDate ? `, due ${fmtDate(a.dueDate)}` : ""}`),
    notes: notes.map(n => `${n.body} (${n.author.firstName} ${n.author.lastName})`),
    planUrl: `${appUrl()}/students/${student.id}`,
  };
}

const esc = (s: string) => s.replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
const list = (title: string, items: string[]) => items.length ? `<p style="margin:10px 0 4px"><b>${esc(title)}</b></p><ul style="margin:0 0 6px;padding-left:20px">${items.map(i => `<li>${esc(i)}</li>`).join("")}</ul>` : "";

function childHtml(k: ChildWeek): string {
  const stat = (n: string, label: string) => `<td style="padding:8px 10px;background:#F4F4F2;border-radius:8px;text-align:center"><div style="font-size:20px;font-weight:800">${esc(n)}</div><div style="font-size:12px;color:#64646A">${esc(label)}</div></td>`;
  return `<div style="border-top:1px solid #DADAD5;padding-top:14px;margin-top:14px">
<h2 style="font-size:18px;margin:0 0 10px">${esc(k.name)}</h2>
<table role="presentation" style="border-collapse:separate;border-spacing:6px;margin:0 -6px 6px"><tr>
${stat(`${k.complete}/${k.schoolDays}`, "full days")}${stat(`${k.streak}`, "day streak")}${stat(`${k.mastered.length}`, "skills mastered")}${stat(`${k.practiceSets}`, "practice sets")}
</tr></table>
${k.practicePct !== null ? `<p style="margin:4px 0;font-size:14px">Practice accuracy this week: <b>${k.practicePct}%</b>.</p>` : ""}
${list("Mastered this week", k.mastered)}${list("Project steps approved", k.steps)}${list("Still to do", k.open)}${list("From their coach", k.notes)}
<p style="margin:10px 0 0"><a href="${esc(k.planUrl)}" style="color:#8A5800;font-weight:700">See ${esc(k.name)}'s full plan</a></p></div>`;
}

/** The weekly email for one parent, or null if there's nothing to send (no linked children or no school days). */
export async function weeklyEmailFor(parentId: string, today?: Date): Promise<Email | null> {
  const parent = await db.user.findUnique({ where: { id: parentId }, include: { school: true, children: { include: { student: true } } } });
  if (!parent?.email || !parent.school || parent.role !== "PARENT") return null;
  const day = today ?? todayIn(parent.school.timezone);
  const kids = parent.children.map(c => c.student).filter(s => s.active);
  if (!kids.length) return null;
  const weeks = await Promise.all(kids.map(k => childWeek(k, parent.school!, day)));
  if (weeks.every(w => w.schoolDays === 0)) return null;
  let token = parent.emailToken;
  if (!token) { token = newToken(); await db.user.update({ where: { id: parent.id }, data: { emailToken: token } }); }
  const names = weeks.map(w => w.name);
  const who = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return {
    kind: "weekly", to: parent.email, schoolId: parent.schoolId,
    subject: `${who}'s week at ${parent.school.name}`,
    heading: `${who}'s week`,
    paragraphs: [`Hi ${parent.firstName}, here's the week of ${fmtDate(mondayOf(day), { month: "long", day: "numeric" })} at ${parent.school.name}. A full day means checking in, learning and reflecting.`, ...weeks.map(w => ({ html: childHtml(w) }))],
    footer: `You get this because you're a parent at ${parent.school.name} on Presumptuous Learning.`,
    unsubscribe: `${appUrl()}/api/unsubscribe?t=${token}`,
    dedupeKey: `weekly:${parent.id}:${isoDate(mondayOf(day))}`,
  };
}

/** Sends this week's email to every parent whose school has reached Friday afternoon. Safe to run often. */
export async function runWeekly(now = new Date(), force = false): Promise<{ sent: number; skipped: number; failed: number; considered: number }> {
  const out = { sent: 0, skipped: 0, failed: 0, considered: 0 };
  const schools = await db.school.findMany({ where: { isDemo: false } });
  for (const school of schools) {
    const today = todayIn(school.timezone, now);
    if (!force && (today.getUTCDay() !== SEND_DAY || clockIn(school.timezone, now) < SEND_FROM)) continue;
    const parents = await db.user.findMany({ where: { schoolId: school.id, role: "PARENT", active: true, weeklyEmail: true, email: { not: null } }, select: { id: true } });
    for (const p of parents) {
      out.considered++;
      const key = `weekly:${p.id}:${isoDate(mondayOf(today))}`;
      if (await db.emailLog.findUnique({ where: { dedupeKey: key } })) continue;
      const email = await weeklyEmailFor(p.id, today);
      if (!email) continue;
      const r = await sendEmail(email);
      if (r === "SENT") out.sent++; else if (r === "SKIPPED") out.skipped++; else if (r === "FAILED") out.failed++;
    }
  }
  return out;
}
