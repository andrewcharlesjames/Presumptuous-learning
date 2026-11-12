import { addDays, utcDate, weekdayIndex } from "./dates.ts";

export type BlockKindName = "ASSEMBLY" | "ACADEMICS" | "BREAK" | "ARTS" | "LUNCH" | "LIFE_SKILLS" | "REFLECTION" | "OTHER";
export type CalendarKindName = "FIRST_DAY" | "LAST_DAY" | "HOLIDAY" | "BREAK" | "PA_DAY" | "REPORT" | "EVENT";

export const BLOCK_KIND_LABEL: Record<BlockKindName, string> = {
  ASSEMBLY: "Morning assembly", ACADEMICS: "Core academics", BREAK: "Break", ARTS: "Arts",
  LUNCH: "Lunch", LIFE_SKILLS: "Life skills", REFLECTION: "Reflection & leadership", OTHER: "Other",
};

export const CALENDAR_KIND_LABEL: Record<CalendarKindName, string> = {
  FIRST_DAY: "First day of school", LAST_DAY: "Last day of school", HOLIDAY: "Holiday", BREAK: "Break",
  PA_DAY: "PA day", REPORT: "Report card", EVENT: "Event",
};

/** Default school day: arts- and life-skills-centred, with two hours of personalized academics. */
export const DEFAULT_DAY: { start: string; end: string; title: string; kind: BlockKindName; focus: string }[] = [
  { start: "09:00", end: "09:30", title: "Morning Assembly", kind: "ASSEMBLY", focus: "Goal setting and mindfulness" },
  { start: "09:30", end: "11:30", title: "Core Academics", kind: "ACADEMICS", focus: "Personalized math, language, science and social studies" },
  { start: "11:30", end: "12:00", title: "Outdoor Break & Snack", kind: "BREAK", focus: "Physical activity and connection" },
  { start: "12:00", end: "14:00", title: "Arts", kind: "ARTS", focus: "Visual arts, drama, music and media arts" },
  { start: "14:00", end: "14:30", title: "Lunch", kind: "LUNCH", focus: "Rest and connection" },
  { start: "14:30", end: "15:30", title: "Life Skills", kind: "LIFE_SKILLS", focus: "Financial literacy, entrepreneurship and projects" },
  { start: "15:30", end: "16:00", title: "Reflection & Leadership", kind: "REFLECTION", focus: "Personal development and leadership" },
];

const nthWeekday = (y: number, m: number, weekday: number, n: number) => {
  // weekday: 0 = Monday
  const first = utcDate(y, m, 1);
  const offset = (weekday - weekdayIndex(first) + 7) % 7;
  return addDays(first, offset + 7 * (n - 1));
};

const weekdayOnOrBefore = (d: Date) => addDays(d, -Math.max(0, weekdayIndex(d) - 4));

/** Gregorian Easter Sunday (anonymous algorithm). */
export function easter(y: number): Date {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return utcDate(y, month - 1, day);
}

export type TemplateEvent = { kind: CalendarKindName; title: string; startDate: Date; endDate: Date; noSchool: boolean };

/**
 * A typical Ontario school year starting in September of `y`. Boards set their own dates (and PA days),
 * so every school reviews and edits this template.
 */
export function ontarioYear(y: number): { yearStart: Date; yearEnd: Date; events: TemplateEvent[] } {
  const labourDay = nthWeekday(y, 8, 0, 1);
  const firstDay = addDays(labourDay, 1);
  const thanksgiving = nthWeekday(y, 9, 0, 2);
  const dec24 = utcDate(y, 11, 24);
  const winterStart = addDays(dec24, -Math.min(weekdayIndex(dec24), 4));
  const jan1 = utcDate(y + 1, 0, 1);
  const winterEnd = addDays(jan1, (4 - weekdayIndex(jan1) + 7) % 7);
  const familyDay = nthWeekday(y + 1, 1, 0, 3);
  const marchStart = nthWeekday(y + 1, 2, 0, 3);
  const es = easter(y + 1);
  let may25 = utcDate(y + 1, 4, 24);
  while (weekdayIndex(may25) !== 0) may25 = addDays(may25, -1);
  let lastDay = utcDate(y + 1, 5, 30);
  while (weekdayIndex(lastDay) !== 4) lastDay = addDays(lastDay, -1);

  const one = (kind: CalendarKindName, title: string, d: Date, noSchool = true): TemplateEvent => ({ kind, title, startDate: d, endDate: d, noSchool });
  const events: TemplateEvent[] = [
    one("HOLIDAY", "Labour Day", labourDay),
    one("FIRST_DAY", "First day of school", firstDay, false),
    one("HOLIDAY", "Thanksgiving", thanksgiving),
    { kind: "BREAK", title: "Winter break", startDate: winterStart, endDate: winterEnd, noSchool: true },
    one("HOLIDAY", "Family Day", familyDay),
    { kind: "BREAK", title: "March break", startDate: marchStart, endDate: addDays(marchStart, 4), noSchool: true },
    one("HOLIDAY", "Good Friday", addDays(es, -2)),
    one("HOLIDAY", "Easter Monday", addDays(es, 1)),
    one("HOLIDAY", "Victoria Day", may25),
    one("LAST_DAY", "Last day of school", lastDay, false),
    one("REPORT", "Progress report", weekdayOnOrBefore(utcDate(y, 10, 15)), false),
    one("REPORT", "Term 1 report card", weekdayOnOrBefore(utcDate(y + 1, 1, 15)), false),
    one("REPORT", "Final report card", lastDay, false),
  ];
  return { yearStart: firstDay, yearEnd: lastDay, events };
}
