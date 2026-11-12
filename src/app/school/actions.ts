"use server";
import { plural } from "@/lib/subjects";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSchoolUser, requireUser } from "@/lib/auth";
import { canManageStudent } from "@/lib/access";
import { db } from "@/lib/db";
import { setFlash } from "@/lib/flash";
import { hashPassword, kidPassword, tempPassword } from "@/lib/passwords";
import { uniqueFamilyCode, uniqueUsername } from "@/lib/records";
import { parseIsoDate, schoolYearOf } from "@/lib/dates";
import { DEFAULT_DAY, ontarioYear, type BlockKindName, type CalendarKindName } from "@/lib/templates";
import { parseCsv } from "@/lib/csv";
import { audit } from "@/lib/audit";
import { issueResetLink } from "@/lib/resets";
import { students } from "@/lib/licence";

const admin = () => requireSchoolUser(["SCHOOL_ADMIN"]);
const back = async (path: string, tone: "ok" | "error", text: string, secret?: { label: string; value: string }[]) => {
  await setFlash({ tone, text, secret });
  revalidatePath(path);
  redirect(path);
};
const gradeSchema = z.coerce.number().int().min(0).max(12);

/* ---------------- people ---------------- */

const studentSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  grade: gradeSchema,
  username: z.string().trim().max(40).optional(),
  classId: z.string().optional(),
});

export async function addStudent(form: FormData) {
  const { school } = await admin();
  const p = studentSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return back("/school/people", "error", "Add a first name, last name and grade.");
  const d = p.data;
  const used = await db.user.count({ where: { schoolId: school.id, role: "STUDENT", active: true } });
  if (used + 1 > school.seats) return back("/school/people", "error", `Your licence covers ${students(school.seats)} and you have ${used}. Deactivate a student or contact Presumptuous Learning to add seats.`);
  const username = await uniqueUsername(school.id, d.firstName, d.lastName, d.username);
  const password = kidPassword();
  const cls = d.classId ? await db.class.findFirst({ where: { id: d.classId, schoolId: school.id } }) : null;
  const student = await db.user.create({
    data: {
      role: "STUDENT", schoolId: school.id, firstName: d.firstName, lastName: d.lastName, grade: d.grade, username,
      passwordHash: await hashPassword(password), familyCode: await uniqueFamilyCode(),
      ...(cls ? { studentIn: { create: { classId: cls.id } } } : {}),
    },
  });
  await audit((await admin()).user, "student.add", { studentId: student.id, detail: `${d.firstName} ${d.lastName}` });
  return back("/school/people", "ok", `Added ${d.firstName} ${d.lastName}.`, [
    { label: "School code", value: school.code }, { label: "Username", value: username }, { label: "Password", value: password },
    { label: "Family code for parents", value: student.familyCode! },
  ]);
}

/** CSV columns: first_name, last_name, grade, username (optional), class (optional, by name) */
export async function importStudents(form: FormData) {
  const { school } = await admin();
  const rows = parseCsv(String(form.get("csv") ?? ""));
  if (rows.length < 2) return back("/school/people", "error", "Paste a header row and at least one student.");
  const header = rows[0].map(h => h.trim().toLowerCase().replace(/[\s-]+/g, "_"));
  const col = (n: string[]) => header.findIndex(h => n.includes(h));
  const iF = col(["first_name", "first", "firstname"]), iL = col(["last_name", "last", "lastname"]), iG = col(["grade"]);
  const iU = col(["username", "user"]), iC = col(["class", "class_name"]);
  if (iF < 0 || iL < 0 || iG < 0) return back("/school/people", "error", "The header row needs first_name, last_name and grade columns.");
  const used = await db.user.count({ where: { schoolId: school.id, role: "STUDENT", active: true } });
  if (used + rows.length - 1 > school.seats) return back("/school/people", "error", `That list has ${students(rows.length - 1)}. Your licence covers ${school.seats} and you have ${used}, so there's room for ${Math.max(0, school.seats - used)}. Contact Presumptuous Learning to add seats.`);
  const classes = await db.class.findMany({ where: { schoolId: school.id } });
  const byName = new Map(classes.map(c => [c.name.toLowerCase(), c.id]));
  const password = kidPassword();
  const passwordHash = await hashPassword(password);
  let added = 0;
  const problems: string[] = [];
  for (const [n, r] of rows.slice(1).entries()) {
    const first = r[iF]?.trim(), last = r[iL]?.trim();
    const gRaw = (r[iG] ?? "").trim().toUpperCase();
    const grade = gRaw === "K" || gRaw === "JK" || gRaw === "SK" ? 0 : Number(gRaw);
    if (!first || !last || !Number.isInteger(grade) || grade < 0 || grade > 12) { problems.push(`row ${n + 2}`); continue; }
    const username = await uniqueUsername(school.id, first, last, iU >= 0 ? r[iU]?.trim() : undefined);
    const classId = iC >= 0 ? byName.get((r[iC] ?? "").trim().toLowerCase()) : undefined;
    await db.user.create({
      data: {
        role: "STUDENT", schoolId: school.id, firstName: first, lastName: last, grade, username, passwordHash,
        familyCode: await uniqueFamilyCode(), ...(classId ? { studentIn: { create: { classId } } } : {}),
      },
    });
    added++;
  }
  if (added) await audit((await admin()).user, "student.import", { detail: `${added} students` });
  return back("/school/people", added ? "ok" : "error",
    `Imported ${added} student${added === 1 ? "" : "s"}.${problems.length ? ` Skipped ${problems.join(", ")} (check name and grade).` : ""}${added ? " Everyone imported shares the starting password below; reset any student's password from their row." : ""}`,
    added ? [{ label: "School code", value: school.code }, { label: "Starting password", value: password }] : undefined);
}

const staffSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  email: z.string().trim().email(),
  role: z.enum(["COACH", "SCHOOL_ADMIN"]),
});

export async function addStaff(form: FormData) {
  const { school } = await admin();
  const p = staffSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return back("/school/people", "error", "Add a name and a valid email.");
  const d = p.data;
  if (await db.user.findUnique({ where: { email: d.email.toLowerCase() } })) return back("/school/people", "error", `${d.email} already has an account.`);
  const password = tempPassword();
  await db.user.create({ data: { role: d.role, schoolId: school.id, email: d.email.toLowerCase(), firstName: d.firstName, lastName: d.lastName, passwordHash: await hashPassword(password) } });
  const title = d.role === "COACH" ? school.coachTitle.toLowerCase() : "school admin";
  await audit((await admin()).user, "staff.add", { detail: `${d.firstName} ${d.lastName} (${d.role === "COACH" ? school.coachTitle : "School admin"}, ${d.email.toLowerCase()})` });
  return back("/school/people", "ok", `Added ${d.firstName} as a ${title}. Send them these sign-in details; they can change the password after signing in.`, [
    { label: "Email", value: d.email.toLowerCase() }, { label: "Temporary password", value: password },
  ]);
}

/** Reset a password. School admins: anyone in the school. Coaches: their own students. */
export async function resetPassword(form: FormData) {
  const viewer = await requireUser(["SCHOOL_ADMIN", "COACH"]);
  const id = String(form.get("id") ?? "");
  const returnTo = String(form.get("returnTo") ?? "/");
  const target = await db.user.findUnique({ where: { id } });
  if (!target || target.schoolId !== viewer.schoolId) return back(returnTo, "error", "That person isn't in your school.");
  const allowed = viewer.role === "SCHOOL_ADMIN" ? target.role !== "PLATFORM_ADMIN" : target.role === "STUDENT" && await canManageStudent(viewer, id);
  if (!allowed) return back(returnTo, "error", "You can't reset that password.");
  const password = target.role === "STUDENT" ? kidPassword() : tempPassword();
  await db.user.update({ where: { id }, data: { passwordHash: await hashPassword(password) } });
  await db.session.deleteMany({ where: { userId: id } });
  await audit(viewer, "password.reset", { studentId: target.role === "STUDENT" ? id : undefined, detail: `${target.firstName} ${target.lastName}` });
  return back(returnTo, "ok", `New password for ${target.firstName} ${target.lastName}.`, [
    ...(target.username ? [{ label: "Username", value: target.username }] : target.email ? [{ label: "Email", value: target.email }] : []),
    { label: "Password", value: password },
  ]);
}

/** School admin: email an adult in the school a one-time link to choose their own password. */
export async function emailResetLink(form: FormData) {
  const { user, school } = await admin();
  const target = await db.user.findFirst({ where: { id: String(form.get("id") ?? ""), schoolId: school.id, role: { in: ["COACH", "SCHOOL_ADMIN", "PARENT"] } } });
  if (!target?.email) return back("/school/people", "error", "That person has no email address. Use New password instead.");
  const r = await issueResetLink(target, `${user.firstName} ${user.lastName} at ${school.name}`);
  await audit(user, "password.link", { detail: `${target.firstName} ${target.lastName}` });
  if (r?.status === "SENT") return back("/school/people", "ok", `Emailed a reset link to ${target.email}. It works once, for an hour.`);
  return back("/school/people", "ok", `Email isn't working right now, so pass this link to ${target.firstName} yourself. It works once, for an hour.`, [{ label: "Reset link", value: r!.link }]);
}

export async function setActive(form: FormData) {
  const { user, school } = await admin();
  const id = String(form.get("id") ?? "");
  const active = form.get("active") === "true";
  const target = await db.user.findFirst({ where: { id, schoolId: school.id } });
  if (!target || target.id === user.id) return back("/school/people", "error", "You can't change that account.");
  if (active && target.role === "STUDENT") {
    const used = await db.user.count({ where: { schoolId: school.id, role: "STUDENT", active: true } });
    if (used + 1 > school.seats) return back("/school/people", "error", `Your licence covers ${students(school.seats)} and all seats are in use.`);
  }
  await db.user.update({ where: { id }, data: { active } });
  if (!active) await db.session.deleteMany({ where: { userId: id } });
  await audit(user, active ? "account.reactivate" : "account.deactivate", { studentId: target.role === "STUDENT" ? id : undefined, detail: `${target.firstName} ${target.lastName}` });
  return back("/school/people", "ok", `${target.firstName} ${target.lastName} is now ${active ? "active" : "deactivated"}.`);
}

export async function updateStudentGrade(form: FormData) {
  const { school } = await admin();
  const id = String(form.get("id") ?? "");
  const g = gradeSchema.safeParse(form.get("grade"));
  const target = await db.user.findFirst({ where: { id, schoolId: school.id, role: "STUDENT" } });
  if (!target || !g.success) return back("/school/people", "error", "Choose a grade from K to 12.");
  await db.user.update({ where: { id }, data: { grade: g.data } });
  await audit((await admin()).user, "student.grade", { studentId: id, detail: `Grade ${target.grade ?? "?"} → ${g.data}` });
  return back(`/students/${id}`, "ok", `Grade updated.`);
}

/* ---------------- classes ---------------- */

export async function createClass(form: FormData) {
  const { school } = await admin();
  const name = String(form.get("name") ?? "").trim();
  const grades = form.getAll("grades").map(Number).filter(g => Number.isInteger(g) && g >= 0 && g <= 12);
  if (!name) return back("/school/classes", "error", "Give the class a name.");
  const c = await db.class.create({ data: { schoolId: school.id, name, grades } });
  return back(`/school/classes/${c.id}`, "ok", `Created ${name}. Now choose its ${plural(school.coachTitle).toLowerCase()} and students.`);
}

export async function saveClassMembers(form: FormData) {
  const { school } = await admin();
  const id = String(form.get("id") ?? "");
  const cls = await db.class.findFirst({ where: { id, schoolId: school.id } });
  if (!cls) return back("/school/classes", "error", "Class not found.");
  const name = String(form.get("name") ?? "").trim() || cls.name;
  const coachIds = (await db.user.findMany({ where: { id: { in: form.getAll("coach").map(String) }, schoolId: school.id, role: { in: ["COACH", "SCHOOL_ADMIN"] } }, select: { id: true } })).map(u => u.id);
  const studentIds = (await db.user.findMany({ where: { id: { in: form.getAll("student").map(String) }, schoolId: school.id, role: "STUDENT" }, select: { id: true } })).map(u => u.id);
  await db.$transaction([
    db.class.update({ where: { id }, data: { name } }),
    db.classCoach.deleteMany({ where: { classId: id } }),
    db.classStudent.deleteMany({ where: { classId: id } }),
    db.classCoach.createMany({ data: coachIds.map(coachId => ({ classId: id, coachId })) }),
    db.classStudent.createMany({ data: studentIds.map(studentId => ({ classId: id, studentId })) }),
  ]);
  return back(`/school/classes/${id}`, "ok", `Saved ${name}: ${coachIds.length} ${(coachIds.length === 1 ? school.coachTitle : plural(school.coachTitle)).toLowerCase()}, ${studentIds.length} student${studentIds.length === 1 ? "" : "s"}.`);
}

export async function deleteClass(form: FormData) {
  const { school } = await admin();
  const id = String(form.get("id") ?? "");
  const cls = await db.class.findFirst({ where: { id, schoolId: school.id } });
  if (cls) await db.class.delete({ where: { id } });
  return back("/school/classes", "ok", cls ? `Deleted ${cls.name}. Students and their records are kept.` : "Class not found.");
}

/* ---------------- school day ---------------- */

const KINDS: BlockKindName[] = ["ASSEMBLY", "ACADEMICS", "BREAK", "ARTS", "LUNCH", "LIFE_SKILLS", "REFLECTION", "OTHER"];
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function saveSchedule(form: FormData) {
  const { school } = await admin();
  const starts = form.getAll("start").map(String), ends = form.getAll("end").map(String);
  const titles = form.getAll("title").map(String), kinds = form.getAll("kind").map(String), focus = form.getAll("focus").map(String);
  const dayLists = form.getAll("days").map(String);
  const rows = starts.map((start, i) => ({
    start, end: ends[i], title: titles[i]?.trim(), kind: kinds[i] as BlockKindName, focus: focus[i]?.trim() ?? "",
    days: [...new Set((dayLists[i] ?? "0,1,2,3,4").split(",").map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 4))].sort(),
  })).filter(r => r.title);
  for (const r of rows) {
    if (!TIME.test(r.start) || !TIME.test(r.end) || r.end <= r.start || !KINDS.includes(r.kind)) {
      return back("/school/schedule", "error", `Check "${r.title}": it needs a start time before its end time.`);
    }
  }
  if (rows.some(r => !r.days.length)) return back("/school/schedule", "error", "Every block needs at least one day.");
  rows.sort((a, b) => a.start.localeCompare(b.start));
  for (let d = 0; d < 5; d++) {
    const today = rows.filter(r => r.days.includes(d));
    for (let i = 1; i < today.length; i++) {
      if (today[i].start < today[i - 1].end) return back("/school/schedule", "error", `"${today[i].title}" overlaps "${today[i - 1].title}" on ${["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"][d]}.`);
    }
  }
  await db.$transaction([
    db.scheduleBlock.deleteMany({ where: { schoolId: school.id } }),
    db.scheduleBlock.createMany({ data: rows.map((r, position) => ({ ...r, position, schoolId: school.id })) }),
  ]);
  return back("/school/schedule", "ok", "School day saved. Students see it on their Today screen.");
}

export async function resetSchedule() {
  const { school } = await admin();
  await db.$transaction([
    db.scheduleBlock.deleteMany({ where: { schoolId: school.id } }),
    db.scheduleBlock.createMany({ data: DEFAULT_DAY.map((b, position) => ({ ...b, position, schoolId: school.id })) }),
  ]);
  return back("/school/schedule", "ok", "Restored the default school day.");
}

/* ---------------- calendar ---------------- */

const CAL_KINDS: CalendarKindName[] = ["FIRST_DAY", "LAST_DAY", "HOLIDAY", "BREAK", "PA_DAY", "REPORT", "EVENT"];

export async function addEvent(form: FormData) {
  const { school } = await admin();
  const title = String(form.get("title") ?? "").trim();
  const kind = String(form.get("kind")) as CalendarKindName;
  const start = parseIsoDate(String(form.get("startDate") ?? ""));
  const end = parseIsoDate(String(form.get("endDate") ?? "")) ?? start;
  if (!title || !start || !end || end < start || !CAL_KINDS.includes(kind)) return back("/school/calendar", "error", "Give the event a title and valid dates.");
  const noSchool = form.get("noSchool") === "on" || ["HOLIDAY", "BREAK", "PA_DAY"].includes(kind);
  await db.calendarEvent.create({ data: { schoolId: school.id, title, kind, startDate: start, endDate: end, noSchool } });
  return back("/school/calendar", "ok", `Added ${title}.`);
}

export async function deleteEvent(form: FormData) {
  const { school } = await admin();
  await db.calendarEvent.deleteMany({ where: { id: String(form.get("id") ?? ""), schoolId: school.id } });
  return back("/school/calendar", "ok", "Removed.");
}

export async function saveYear(form: FormData) {
  const { school } = await admin();
  const start = parseIsoDate(String(form.get("yearStart") ?? "")), end = parseIsoDate(String(form.get("yearEnd") ?? ""));
  if (!start || !end || end <= start) return back("/school/calendar", "error", "The last day must come after the first day.");
  await db.school.update({ where: { id: school.id }, data: { yearStart: start, yearEnd: end } });
  return back("/school/calendar", "ok", "School year dates saved.");
}

export async function applyOntarioTemplate(form: FormData) {
  const { school } = await admin();
  const y = Number(form.get("year")) || schoolYearOf(school.yearStart);
  const t = ontarioYear(y);
  await db.$transaction([
    db.calendarEvent.deleteMany({ where: { schoolId: school.id, startDate: { gte: t.yearStart }, endDate: { lte: t.yearEnd } } }),
    db.calendarEvent.deleteMany({ where: { schoolId: school.id, title: "Labour Day", startDate: { gte: new Date(Date.UTC(y, 8, 1)) , lte: t.yearStart } } }),
    db.calendarEvent.createMany({ data: t.events.map(e => ({ ...e, schoolId: school.id })) }),
    db.school.update({ where: { id: school.id }, data: { yearStart: t.yearStart, yearEnd: t.yearEnd } }),
  ]);
  return back("/school/calendar", "ok", `Loaded the ${y}–${String(y + 1).slice(2)} Ontario template. Add your board's PA days and check every date.`);
}

/* ---------------- settings ---------------- */

const settingsSchema = z.object({
  name: z.string().trim().min(2).max(120),
  coachTitle: z.string().trim().min(2).max(30),
  timezone: z.string().trim().min(3).max(60),
});

export async function saveSettings(form: FormData) {
  const { school } = await admin();
  const p = settingsSchema.safeParse({ name: form.get("name"), coachTitle: form.get("coachTitle"), timezone: form.get("timezone") });
  if (!p.success) return back("/school/settings", "error", "Check the school name and title.");
  try { new Intl.DateTimeFormat("en-CA", { timeZone: p.data.timezone }); } catch { return back("/school/settings", "error", "That time zone isn't recognised."); }
  const launchRaw = String(form.get("launchDay") ?? "");
  const launchDay = launchRaw ? parseIsoDate(launchRaw) : null;
  if (launchRaw && !launchDay) return back("/school/settings", "error", "That Launch Day date isn't valid.");
  await db.school.update({ where: { id: school.id }, data: { ...p.data, aiTutor: form.get("aiTutor") === "on", aiNeedsConsent: form.get("aiNeedsConsent") === "on", ...(launchDay ? { launchDay } : {}) } });
  await audit((await admin()).user, "settings.change", { detail: `AI tutor ${form.get("aiTutor") === "on" ? "on" : "off"}; AI needs consent ${form.get("aiNeedsConsent") === "on" ? "yes" : "no"}` });
  if (launchDay && (!school.launchDay || school.launchDay.getTime() !== launchDay.getTime())) {
    // Move every project's Launch Day milestone to the new date.
    await db.projectMilestone.updateMany({ where: { key: "launch", project: { schoolId: school.id, schoolYear: schoolYearOf(launchDay) } }, data: { dueDate: launchDay } });
  }
  return back("/school/settings", "ok", "Settings saved.");
}
