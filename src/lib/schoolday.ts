import "server-only";
import type { School } from "@prisma/client";
import { db } from "./db";
import { addDays, isoDate, mondayOf, todayIn } from "./dates";

/** Minutes the time zone is ahead of UTC at an instant (e.g. -240 for Toronto in summer). */
function offsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" }).formatToParts(instant);
  const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(parts.find(p => p.type === "timeZoneName")?.value ?? "");
  return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0)) : 0;
}

/** The UTC instants where a local calendar date starts and ends. Offsets are read at noon, away from DST switches. */
export function dayBounds(date: Date, timeZone: string): { start: Date; end: Date } {
  const at = (d: Date) => new Date(d.getTime() - offsetMinutes(new Date(d.getTime() + 12 * 3600000), timeZone) * 60000);
  return { start: at(date), end: at(addDays(date, 1)) };
}

/** Calendar dates that are school days in [from, to], given the school's calendar. */
export async function schoolDays(school: Pick<School, "id" | "yearStart" | "yearEnd">, from: Date, to: Date): Promise<Set<string>> {
  const closed = await db.calendarEvent.findMany({ where: { schoolId: school.id, noSchool: true, startDate: { lte: to }, endDate: { gte: from } } });
  const out = new Set<string>();
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const wd = d.getUTCDay();
    if (wd === 0 || wd === 6) continue;
    if (d < school.yearStart || d > school.yearEnd) continue;
    if (closed.some(e => e.startDate <= d && e.endDate >= d)) continue;
    out.add(isoDate(d));
  }
  return out;
}

export type DayStatus = {
  date: string; schoolDay: boolean; checkedIn: boolean; mood: number | null; learning: number;
  arts: boolean; life: boolean; reflected: boolean; complete: boolean;
};

/**
 * Day-by-day status for students over a date range: check-in, learning activities (practice sets and
 * mastery checks finished that day), arts and life-skills prompts, reflection. A day is complete with a
 * check-in, at least one learning activity, and a reflection.
 */
export async function dayStatuses(school: Pick<School, "id" | "timezone" | "yearStart" | "yearEnd">, studentIds: string[], from: Date, to: Date) {
  const [days, logs, sessions] = await Promise.all([
    schoolDays(school, from, to),
    db.dailyLog.findMany({ where: { studentId: { in: studentIds }, date: { gte: from, lte: to } } }),
    db.practiceSession.findMany({
      where: { studentId: { in: studentIds }, completedAt: { gte: dayBounds(from, school.timezone).start, lt: dayBounds(to, school.timezone).end } },
      select: { studentId: true, completedAt: true },
    }),
  ]);
  const learning = new Map<string, number>();
  for (const s of sessions) {
    const k = `${s.studentId}:${isoDate(todayIn(school.timezone, s.completedAt!))}`;
    learning.set(k, (learning.get(k) ?? 0) + 1);
  }
  const logBy = new Map(logs.map(l => [`${l.studentId}:${isoDate(l.date)}`, l]));
  const out = new Map<string, DayStatus[]>();
  for (const sid of studentIds) {
    const list: DayStatus[] = [];
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const key = isoDate(d);
      const l = logBy.get(`${sid}:${key}`);
      const n = learning.get(`${sid}:${key}`) ?? 0;
      const checkedIn = !!l?.checkedInAt, reflected = !!l?.reflectedAt;
      list.push({
        date: key, schoolDay: days.has(key), checkedIn, mood: l?.mood ?? null, learning: n,
        arts: !!l?.artsDone, life: !!l?.lifeDone, reflected, complete: checkedIn && n > 0 && reflected,
      });
    }
    out.set(sid, list);
  }
  return out;
}

/** Consecutive completed school days, counting back from today (today counts only once it's complete). */
export async function streaks(school: Pick<School, "id" | "timezone" | "yearStart" | "yearEnd">, studentIds: string[]) {
  const today = todayIn(school.timezone);
  const from = addDays(today, -70);
  const st = await dayStatuses(school, studentIds, from, today);
  const out = new Map<string, { current: number; best: number }>();
  for (const sid of studentIds) {
    const days = (st.get(sid) ?? []).filter(d => d.schoolDay);
    let current = 0, best = 0, run = 0;
    for (const d of days) { run = d.complete ? run + 1 : 0; best = Math.max(best, run); }
    for (let i = days.length - 1; i >= 0; i--) {
      const d = days[i];
      if (d.complete) current++;
      else if (d.date === isoDate(today)) continue; // today isn't over yet
      else break;
    }
    out.set(sid, { current, best });
  }
  return out;
}

export function weekRange(today: Date) {
  const mon = mondayOf(today);
  return { from: mon, to: addDays(mon, 4) };
}
