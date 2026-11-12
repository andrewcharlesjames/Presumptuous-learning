// Ontario-style report rules (no database): terms, marks, learning skills and comment drafts.
import { inSentence } from "./words.ts";

export const TERMS = [
  { n: 0, name: "Fall progress report", short: "Fall progress", season: "November" },
  { n: 1, name: "Term 1 report card", short: "Term 1", season: "February" },
  { n: 2, name: "Term 2 report card", short: "Term 2", season: "June" },
] as const;
export type Term = 0 | 1 | 2;
export const isTerm = (x: unknown): x is Term => x === 0 || x === 1 || x === 2;

/** Sept–Nov: fall progress report; Dec–Feb: term 1; Mar–Aug: term 2. date is a UTC calendar date. */
export function currentTerm(date: Date): Term {
  const m = date.getUTCMonth();
  return m >= 8 && m <= 10 ? 0 : m === 11 || m <= 1 ? 1 : 2;
}

export const SKILLS = [
  { key: "responsibility", name: "Responsibility", hint: "Finishes work on time, attends, follows through" },
  { key: "organization", name: "Organization", hint: "Plans the day and manages time" },
  { key: "independent", name: "Independent work", hint: "Gets going and keeps going without reminders" },
  { key: "collaboration", name: "Collaboration", hint: "Works well with others" },
  { key: "initiative", name: "Initiative", hint: "Takes on new challenges and ideas" },
  { key: "selfRegulation", name: "Self-regulation", hint: "Sets goals, reflects, asks for help" },
] as const;
export type SkillKey = (typeof SKILLS)[number]["key"];
export const RATINGS = { E: "Excellent", G: "Good", S: "Satisfactory", N: "Needs improvement" } as const;
export type Rating = keyof typeof RATINGS;
export type SkillRatings = Partial<Record<SkillKey, Rating>>;

/** How a subject is reported: progress words (fall), nothing but comments (Kindergarten), letters (1–6) or percentages (7–12). */
export function markFor(term: Term, grade: number, level: 1 | 2 | 3 | 4, status: "below" | "at" | "above"): string {
  if (grade === 0) return "";
  if (term === 0) return status === "above" || level === 4 ? "Progressing very well" : status === "at" ? "Progressing well" : "Progressing with difficulty";
  if (grade <= 6) return { 4: "A", 3: "B", 2: "C", 1: "D" }[level];
  return { 4: "80–100%", 3: "70–79%", 2: "60–69%", 1: "50–59%" }[level];
}

export type Evidence = {
  schoolDays: number; present: number; late: number; absent: number; completeDays: number; reflections: number;
  practiceSets: number; assignmentsDue: number; assignmentsDone: number; projectStepsApproved: number; projectStepsDue: number; masteredSkills: number;
};

const rate = (x: number): Rating => (x >= 0.85 ? "E" : x >= 0.7 ? "G" : x >= 0.5 ? "S" : "N");

/**
 * Suggested learning-skill ratings from what the platform saw this term. Only a starting point:
 * the coach confirms every rating, and collaboration is left for the coach because the platform can't see it.
 */
export function suggestSkills(e: Evidence): SkillRatings {
  if (e.schoolDays < 5) return {};
  const marked = e.present + e.late + e.absent; // only days a coach marked count for attendance
  const attendance = marked ? (e.present + e.late * 0.5) / marked : 1;
  const work = e.assignmentsDue ? e.assignmentsDone / e.assignmentsDue : attendance;
  const steps = e.projectStepsDue ? e.projectStepsApproved / e.projectStepsDue : null;
  return {
    responsibility: rate((attendance + work) / 2),
    organization: rate(e.completeDays / e.schoolDays),
    independent: rate(Math.min(1, e.practiceSets / Math.max(1, e.schoolDays * 0.8))),
    initiative: rate(steps === null ? Math.min(1, e.masteredSkills / Math.max(1, e.schoolDays / 5)) : (steps + Math.min(1, e.masteredSkills / Math.max(1, e.schoolDays / 5))) / 2),
    selfRegulation: rate(e.reflections / e.schoolDays),
  };
}

const join = (xs: string[]) => xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`;

/** A first draft of a subject comment in the usual Ontario shape: a strength, then a next step. */
export function draftComment(o: { first: string; subject: string; status: "below" | "at" | "above"; workingGrade: string; mastered: string[]; next: string[] }): string {
  const where = o.status === "above" ? `is working above grade level in ${o.subject}, at a ${o.workingGrade} level`
    : o.status === "at" ? `is working at grade level in ${o.subject}` : `is building the foundations in ${o.subject} and is working at a ${o.workingGrade} level`;
  const strength = o.mastered.length ? ` ${o.first} has shown mastery of ${join(o.mastered.slice(0, 3).map(inSentence))}.` : "";
  const next = o.next.length ? ` Next steps: ${o.first} will work on ${join(o.next.slice(0, 2).map(inSentence))}.` : "";
  return `${o.first} ${where}.${strength}${next}`.replace(/\s+/g, " ").replace(/\?\./g, "?").trim();
}

/** Level for the Presumptuous Project strand from the share of this term's skills mastered. */
export function entLevel(mastered: number, taught: number): { level: 1 | 2 | 3 | 4; status: "below" | "at" | "above" } {
  const r = taught ? mastered / taught : 0;
  const level = r >= 0.8 ? 4 : r >= 0.6 ? 3 : r >= 0.4 ? 2 : 1;
  return { level, status: level === 4 ? "above" : level === 3 ? "at" : "below" };
}

/** Draft comment for the Presumptuous Project section. */
export function draftEntComment(o: { first: string; project?: string | null; mastered: string[]; taught: number; stepsApproved: number; stepsDue: number; next: string[] }): string {
  const learned = o.mastered.length
    ? `${o.first} has mastered ${o.mastered.length} of ${o.taught} business and life skills this term, including ${join(o.mastered.slice(0, 3).map(inSentence))}.`
    : `${o.first} is beginning to learn the business and life skills for this term.`;
  const project = o.project ? ` ${o.first}'s business, ${o.project}, has ${o.stepsApproved} of ${o.stepsDue} project steps approved so far.` : ` ${o.first} is still choosing a business idea.`;
  const next = o.next.length ? ` Next steps: ${o.first} will work on ${join(o.next.slice(0, 2).map(inSentence))} and apply them to their business.` : "";
  return `${learned}${project}${next}`.replace(/\?\./g, "?");
}
