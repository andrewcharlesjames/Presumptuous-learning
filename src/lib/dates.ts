// Calendar dates are represented as Date objects at 00:00 UTC, so a date never shifts
// with the server's time zone. "Today" is computed in the school's time zone.

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export function utcDate(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d));
}

/** Today's calendar date in a time zone, as a UTC-midnight Date. */
export function todayIn(timeZone: string, now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (t: string) => Number(parts.find(p => p.type === t)!.value);
  return utcDate(get("year"), get("month") - 1, get("day"));
}

/** Current time "HH:MM" in a time zone. */
export function clockIn(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000);
}

/** 0 = Monday … 6 = Sunday */
export function weekdayIndex(d: Date): number {
  return (d.getUTCDay() + 6) % 7;
}

export function mondayOf(d: Date): Date {
  return addDays(d, -weekdayIndex(d));
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseIsoDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = utcDate(+m[1], +m[2] - 1, +m[3]);
  return isoDate(d) === s ? d : null;
}

export function fmtDate(d: Date, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }): string {
  return d.toLocaleDateString("en-CA", { timeZone: "UTC", ...opts });
}

export function fmtLong(d: Date): string {
  return fmtDate(d, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

/** The school year (Sept–June) that contains date d; July/August belong to the coming year. */
export function schoolYearOf(d: Date): number {
  return d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
}

export function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function fmtClock(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, "0")} ${ap}`;
}

/** Format a moment in time (not a calendar date) in a time zone. */
export function fmtStamp(d: Date, timeZone: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }): string {
  return d.toLocaleDateString("en-CA", { timeZone, ...opts });
}
