import Link from "next/link";
import type { School } from "@prisma/client";
import { db } from "@/lib/db";
import { addDays, fmtDate, isoDate, MONTHS, mondayOf, schoolYearOf, todayIn, utcDate } from "@/lib/dates";
import { schoolDays } from "@/lib/schoolday";
import { weekBoard, dayName, type Todo } from "@/lib/week";
import { defaultLaunchDay, PROJECT_LABEL } from "@/lib/projects";
import { describe } from "@/lib/assignments";
import { CardGrid, TodoAction, TodoCard } from "./Cards";
import { Info } from "./Info";

type Student = { id: string; firstName: string; grade: number | null; createdAt: Date };

/** A student's week (to-do cards and a day-by-day board) or month (due dates and events). */
export async function WeekView({ student, school, base, self, view, month }: { student: Student; school: School; base: string; self: boolean; view: "week" | "month"; month?: string }) {
  const q = base.includes("?") ? "&" : "?"; // base may already carry a query (the student view's tab)
  const tabs = (
    <nav className="tabs" aria-label="View">
      <Link className="tab" href={base} aria-current={view === "week" ? "page" : undefined}>Week</Link>
      <Link className="tab" href={`${base}${q}view=month`} aria-current={view === "month" ? "page" : undefined}>Month</Link>
    </nav>
  );
  return view === "month" ? <MonthView student={student} school={school} base={base} q={q} tabs={tabs} month={month} self={self} /> : <WeekBoardView student={student} school={school} tabs={tabs} self={self} />;
}

async function WeekBoardView({ student, school, tabs, self }: { student: Student; school: School; tabs: React.ReactNode; self: boolean }) {
  const today = todayIn(school.timezone);
  const board = await weekBoard(student, school, today);
  const days = await schoolDays(school, board.monday, addDays(board.monday, 4));
  const you = self ? "you" : student.firstName;
  const open = [...board.behind, ...board.catchUp.filter(t => t.kind !== "step" && t.kind !== "start-project"), ...board.today.filter(t => !t.done && t.kind !== "step")];
  const byDay = (iso: string) => [...board.tasks, ...board.steps].filter(t => t.day === iso);
  const undated = board.tasks.filter(t => t.day === null && !t.done);
  return (
    <>
      <div className="spread">
        <div><span className="eyebrow">Week of {fmtDate(board.monday, { month: "long", day: "numeric" })}</span>
          <h1>{self ? "My week" : `${student.firstName}'s week`}<Info label="The week">{"Every lesson, assignment and project step for this school week, Monday to Friday. The list is set on Monday from the plan, so it only gets shorter as the work is done. Anything not finished on its day moves to Still to do, and can be done any day, including the weekend. Check-ins and reflections belong to each day, so they aren't on this list."}</Info></h1></div>
        {tabs}
      </div>

      <section className="stack">
        <div className="section-head"><h2>Still to do this week<Info label="Still to do">{`Everything ${you === "you" ? "you" : student.firstName} still need${self ? "" : "s"} to do up to today: late project steps first, then work from earlier days, then today's. Work through it from the top.`}</Info></h2>
          <span className="small muted">{board.doneCount} of {board.total} done</span></div>
        {open.length ? <CardGrid>{open.map(t => <TodoCard key={t.id} t={t} todayIso={board.todayIso} readOnly={!self} />)}</CardGrid>
          : <div className="hero-card calm"><span className="eyebrow">This week</span><h2>{self ? "You're all caught up" : `${student.firstName} is all caught up`}</h2><p>Nothing is left up to today. {board.later.length ? `${board.later.length} more coming later this week.` : ""}</p></div>}
      </section>

      <section className="stack">
        <div className="section-head"><h2>Day by day<Info label="Day by day">{"Each school day's work. A tick means done; red means it's from an earlier day and still to do. Days with no school (holidays, PA days) are marked."}</Info></h2></div>
        <div className="weekgrid">
          {Array.from({ length: 5 }, (_, i) => {
            const d = addDays(board.monday, i), iso = isoDate(d);
            const items = byDay(iso), isToday = iso === board.todayIso;
            const doneN = items.filter(t => t.done).length;
            return (
              <div key={iso} className={`weekday ${isToday ? "today" : ""}`}>
                <h3><span>{dayName(iso).slice(0, 3)} {d.getUTCDate()}</span>{items.length > 0 && <span className="small muted">{doneN}/{items.length}</span>}</h3>
                {!days.has(iso) ? <span className="small muted">No school</span> : items.length === 0 ? <span className="small muted">Nothing planned</span> :
                  items.map(t => <Mini key={t.id} t={t} self={self} />)}
              </div>
            );
          })}
        </div>
        {undated.length > 0 && <p className="small muted">Also this week: {undated.map(t => t.title).join(" · ")}</p>}
      </section>
    </>
  );
}

function Mini({ t, self }: { t: Todo; self: boolean }) {
  const tone = t.kind === "ent" ? "ent" : t.kind === "assignment" ? "assign" : t.kind === "step" ? "step" : t.kind === "checkup" ? "checkup" : "";
  return (
    <div className={`mini ${tone} ${t.done ? "done" : t.late ? "late" : ""}`}>
      <span className="small muted">{t.eyebrow}</span>
      <b>{t.done ? "✓ " : ""}{t.title}</b>
      {self && !t.done && <div><TodoAction t={t} /></div>}
    </div>
  );
}

async function MonthView({ student, school, base, q, tabs, month, self }: { student: Student; school: School; base: string; q: string; tabs: React.ReactNode; month?: string; self: boolean }) {
  const today = todayIn(school.timezone);
  const m = /^(\d{4})-(\d{2})$/.exec(month ?? "");
  const y = m ? Number(m[1]) : today.getUTCFullYear(), mo = m ? Number(m[2]) - 1 : today.getUTCMonth();
  const first = utcDate(y, mo, 1), last = utcDate(y, mo + 1, 0);
  const gridStart = mondayOf(first), gridEnd = addDays(mondayOf(last), 6);
  const [assignments, milestones, events, days] = await Promise.all([
    db.assignment.findMany({ where: { targets: { some: { studentId: student.id } }, dueDate: { gte: gridStart, lte: gridEnd } } }),
    db.projectMilestone.findMany({ where: { project: { studentId: student.id }, dueDate: { gte: gridStart, lte: gridEnd } }, include: { project: { select: { type: true } } } }),
    db.calendarEvent.findMany({ where: { schoolId: school.id, startDate: { lte: gridEnd }, endDate: { gte: gridStart } } }),
    schoolDays(school, gridStart, gridEnd),
  ]);
  const launch = school.launchDay ?? defaultLaunchDay(schoolYearOf(today));
  const prev = `${utcDate(y, mo - 1, 1).toISOString().slice(0, 7)}`, next = `${utcDate(y, mo + 1, 1).toISOString().slice(0, 7)}`;
  const cells: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) cells.push(d);
  return (
    <>
      <div className="spread">
        <div><span className="eyebrow">{self ? "My" : `${student.firstName}'s`} calendar</span>
          <h1>{MONTHS[mo]} {y}<Info label="Month">{"Due dates and school events for the month: coach assignments, project steps, Launch Day, holidays and PA days. Daily lessons are on the Week tab, so the month stays easy to read. Grey days have no school."}</Info></h1></div>
        {tabs}
      </div>
      <div className="row"><Link className="btn small" href={`${base}${q}view=month&m=${prev}`}>← {MONTHS[(mo + 11) % 12]}</Link>
        <Link className="btn small" href={`${base}${q}view=month`}>This month</Link>
        <Link className="btn small" href={`${base}${q}view=month&m=${next}`}>{MONTHS[(mo + 1) % 12]} →</Link></div>
      <div className="monthgrid" aria-label={`${MONTHS[mo]} ${y}`} role="group">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => <div key={d} className="dow" aria-hidden="true">{d}</div>)}
        {cells.map(d => {
          const iso = isoDate(d);
          const dayEvents = events.filter(e => e.startDate <= d && e.endDate >= d);
          const wd = (d.getUTCDay() + 6) % 7;
          const off = wd >= 5 || !days.has(iso);
          return (
            <div key={iso} aria-label={fmtDate(d, { weekday: "long", month: "long", day: "numeric" })} className={`cell ${d.getUTCMonth() !== mo ? "out" : ""} ${iso === isoDate(today) ? "today" : ""} ${off ? "off" : ""}`}>
              <span className="n">{d.getUTCDate()}</span>
              {iso === isoDate(launch) && <span className="tag launch">Launch Day</span>}
              {dayEvents.map(e => <span key={e.id} className="tag event">{e.title}</span>)}
              {milestones.filter(x => isoDate(x.dueDate) === iso).map(x => <span key={x.id} className="tag step">{x.status === "APPROVED" ? "✓ " : ""}{PROJECT_LABEL[x.project.type].replace(" Project", "")}: {x.title}</span>)}
              {assignments.filter(a => a.dueDate && isoDate(a.dueDate) === iso).map(a => <span key={a.id} className="tag assign">{describe(a)}</span>)}
            </div>
          );
        })}
      </div>
      <p className="small muted"><span className="chip above">Project step</span> <span className="chip at">Coach assignment</span> <span className="chip">School event</span></p>
    </>
  );
}
