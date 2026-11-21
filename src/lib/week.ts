import "server-only";
import type { School } from "@prisma/client";
import { db } from "./db";
import { addDays, isoDate, mondayOf, schoolYearOf, todayIn } from "./dates";
import { dayBounds, schoolDays } from "./schoolday";
import { latestScored, masteredSet } from "./records";
import { buildPlan, MODE_LABEL } from "./plan";
import { ENT, nextSkill } from "./presumptuous";
import { completion, describe } from "./assignments";
import { PROJECT_LABEL } from "./projects";
import { SUBJECT_BY_ID, isSubjectId } from "./subjects";
import { checkupInWeek } from "./checkup";

/** One learning task in a student's week. Check-ins and reflections stay daily habits and are not tasks. */
export type WeekTask = { id: string; day: string; kind: "learn" | "ent"; subject: string; grade: number; skill: string; label: string };

/** Something a student needs to do, ready to show as a card. */
export type Todo = {
  id: string;
  kind: "learn" | "ent" | "assignment" | "step" | "start-project" | "checkup";
  eyebrow: string; // e.g. "Mathematics · Stretch"
  title: string;
  day: string | null; // ISO date it belongs to, or null for "this week"
  done: boolean;
  late: boolean; // from an earlier day and not done
  subject?: string; grade?: number; skill?: string; // learn / ent / assignment
  assignmentKind?: "MASTER_SKILL" | "PRACTICE" | "ASSESSMENT";
  note?: string;
  href?: string; // steps and projects
  status?: "TODO" | "SUBMITTED" | "NEEDS_WORK"; // steps
  inProgress?: boolean; // check-up already started
};

type Student = { id: string; firstName: string; grade: number | null; createdAt: Date };
type SchoolLite = Pick<School, "id" | "timezone" | "yearStart" | "yearEnd">;

const WEEKDAY = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const dayName = (iso: string) => WEEKDAY[(new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7];

/**
 * The week's learning tasks: read the saved list, or make it the first time anyone looks this week.
 * Each school day takes that day's skills from the plan, skipping any already planned earlier in the
 * week, plus one Presumptuous Project skill on days the timetable has that block.
 */
export async function weekTasks(student: Student, school: SchoolLite, today: Date): Promise<{ monday: Date; tasks: WeekTask[] }> {
  const monday = mondayOf(today);
  const saved = await db.weekPlan.findUnique({ where: { studentId_weekOf: { studentId: student.id, weekOf: monday } } });
  if (saved) return { monday, tasks: saved.tasks as WeekTask[] };
  const scored = await latestScored(student.id);
  if (!scored) return { monday, tasks: [] }; // nothing to plan until the assessment is done; try again later
  const [mastered, days, blocks] = await Promise.all([
    masteredSet(student.id),
    schoolDays(school, monday, addDays(monday, 4)),
    db.scheduleBlock.findMany({ where: { schoolId: school.id, kind: "LIFE_SKILLS" }, select: { days: true } }),
  ]);
  const joined = todayIn(school.timezone, student.createdAt);
  // A list made after Monday only plans from that day on: earlier days were never on anyone's list, so they can't be "missed".
  const startFrom = today > joined ? today : joined;
  const planned = new Set(mastered);
  const tasks: WeekTask[] = [];
  const grade = student.grade ?? scored.assessment.grade;
  for (let i = 0; i < 5; i++) {
    const d = addDays(monday, i), iso = isoDate(d);
    if (!days.has(iso) || d < startFrom) continue;
    const plan = buildPlan({ grade: scored.assessment.grade, results: scored.results, today: d, yearEnd: school.yearEnd, skillsAt: scored.skillsAt, mastered: planned });
    for (const b of plan.today.blocks) {
      if (!b.sid || !b.skill || b.skill.startsWith("an independent")) continue;
      const key = `${b.sid}|${b.skill}`;
      if (planned.has(key)) continue;
      planned.add(key);
      tasks.push({ id: `${iso}:${key}`, day: iso, kind: "learn", subject: b.sid, grade: b.grade ?? grade, skill: b.skill, label: MODE_LABEL[b.mode] });
    }
    if (blocks.some(bl => bl.days.includes(i))) {
      const e = nextSkill(d, grade, planned);
      if (e) {
        planned.add(`${ENT}|${e.skill}`);
        tasks.push({ id: `${iso}:${ENT}|${e.skill}`, day: iso, kind: "ent", subject: ENT, grade, skill: e.skill, label: e.kind === "life" ? "Life skill" : "Business skill" });
      }
    }
  }
  try {
    await db.weekPlan.create({ data: { studentId: student.id, weekOf: monday, tasks } });
  } catch { /* made at the same moment by another request: read theirs */
    const again = await db.weekPlan.findUnique({ where: { studentId_weekOf: { studentId: student.id, weekOf: monday } } });
    if (again) return { monday, tasks: again.tasks as WeekTask[] };
  }
  return { monday, tasks };
}

const subjectName = (sid: string, grade: number) => (isSubjectId(sid) ? SUBJECT_BY_ID[sid].name(grade) : sid);

/**
 * Everything on a student's plate this week, with what's done, what's due today and what to catch up on.
 * A task counts as done once the skill is mastered or a lesson check or practice set on it is finished this week,
 * whichever day it happens.
 */
export async function weekBoard(student: Student, school: SchoolLite, today: Date = todayIn(school.timezone)) {
  const { monday, tasks } = await weekTasks(student, school, today);
  const todayIso = isoDate(today);
  const from = dayBounds(monday, school.timezone).start;
  const [mastered, sessions, assignments, projects] = await Promise.all([
    masteredSet(student.id),
    db.practiceSession.findMany({ where: { studentId: student.id, completedAt: { gte: from } }, select: { subject: true, skill: true } }),
    db.assignment.findMany({ where: { targets: { some: { studentId: student.id } } }, include: { targets: { where: { studentId: student.id } }, createdBy: true }, orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }], take: 40 }),
    db.project.findMany({ where: { studentId: student.id, schoolYear: schoolYearOf(today) }, include: { milestones: { orderBy: { position: "asc" } } } }),
  ]);
  const worked = new Set(sessions.map(s => `${s.subject}|${s.skill}`));
  const finished = await completion(assignments);
  const g = student.grade ?? 0;

  const todos: Todo[] = tasks.map(t => {
    const done = mastered.has(`${t.subject}|${t.skill}`) || worked.has(`${t.subject}|${t.skill}`);
    return {
      id: t.id, kind: t.kind, eyebrow: t.kind === "ent" ? `Presumptuous · ${t.label}` : `${subjectName(t.subject, g)} · ${t.label}`,
      title: t.skill, day: t.day, done, late: !done && t.day < todayIso, subject: t.subject, grade: t.grade, skill: t.skill,
    };
  });

  // coach assignments: open ones always; finished ones only if they were due this week
  const weekEnd = isoDate(addDays(monday, 6));
  for (const a of assignments) {
    const doneAt = finished.get(`${a.id}:${student.id}`);
    const due = a.dueDate ? isoDate(a.dueDate) : null;
    if (doneAt && (!due || due < isoDate(monday) || due > weekEnd)) continue;
    todos.push({
      id: `a:${a.id}`, kind: "assignment", eyebrow: `From ${a.createdBy.firstName}`, title: describe(a), day: due && due >= isoDate(monday) ? due : null,
      done: !!doneAt, late: !doneAt && !!due && due < todayIso, subject: a.subject, grade: a.grade, skill: a.skill, assignmentKind: a.kind, note: a.note || undefined,
    });
  }

  // the monthly check-up, on the last school Friday of the month, once the first assessment is done
  const checkup = tasks.length || (await db.assessment.count({ where: { studentId: student.id, status: "COMPLETE" } })) ? await checkupInWeek(school, monday) : null;
  if (checkup) {
    const [doneA, going] = await Promise.all([
      db.assessment.findFirst({ where: { studentId: student.id, status: "COMPLETE", completedAt: { gte: from } }, select: { id: true } }),
      db.assessment.findFirst({ where: { studentId: student.id, status: "IN_PROGRESS", kind: "checkup" }, select: { id: true } }),
    ]);
    todos.push({ id: `checkup:${checkup}`, kind: "checkup", eyebrow: "Monthly check-up", title: "See how far you've come", day: checkup, done: !!doneA, late: !doneA && checkup < todayIso, inProgress: !!going });
  }

  // projects: the next step on each, flagged when it's late; a nudge to start any that haven't begun
  const steps: Todo[] = [];
  for (const p of projects) {
    const m = p.milestones.find(x => x.status !== "APPROVED");
    if (!m) continue;
    const due = isoDate(m.dueDate);
    const late = m.status !== "SUBMITTED" && due < todayIso;
    steps.push({
      id: `m:${m.id}`, kind: "step", eyebrow: `${PROJECT_LABEL[p.type]}${p.title ? ` · ${p.title}` : ""}`, title: m.title, day: due,
      done: m.status === "SUBMITTED", late, href: `/student/projects/${p.id}`, status: m.status as "TODO" | "SUBMITTED" | "NEEDS_WORK",
    });
  }
  const started = new Set(projects.map(p => p.type));
  for (const t of ["LIFE_SKILLS", "PURPOSE"] as const) if (!started.has(t)) {
    steps.push({ id: `start:${t}`, kind: "start-project", eyebrow: PROJECT_LABEL[t], title: t === "LIFE_SKILLS" ? "Start your business" : "Choose a cause to help", day: null, done: false, late: true, href: "/student/projects" });
  }

  const open = todos.filter(t => !t.done);
  return {
    monday, todayIso, tasks: todos, steps,
    today: todos.filter(t => t.day === todayIso),
    catchUp: open.filter(t => t.late),
    later: open.filter(t => !t.late && (t.day === null || t.day > todayIso)),
    doneCount: todos.filter(t => t.done).length,
    total: todos.length,
    behind: steps.filter(s => s.late || s.status === "NEEDS_WORK"),
  };
}

export type WeekBoard = Awaited<ReturnType<typeof weekBoard>>;

/** Makes this week's list for every active student in schools where it's a weekday, so Monday's work is on the list from Monday. */
export async function prepareWeeks(now = new Date()): Promise<number> {
  let made = 0;
  for (const school of await db.school.findMany()) {
    const today = todayIn(school.timezone, now);
    const wd = today.getUTCDay();
    if (wd === 0 || wd === 6 || today < school.yearStart || today > school.yearEnd) continue;
    const monday = mondayOf(today);
    const students = await db.user.findMany({ where: { schoolId: school.id, role: "STUDENT", active: true, weekPlans: { none: { weekOf: monday } } }, select: { id: true, firstName: true, grade: true, createdAt: true } });
    for (const st of students) {
      const r = await weekTasks(st, school, today).catch(() => null);
      if (r?.tasks.length) made++;
    }
  }
  return made;
}
