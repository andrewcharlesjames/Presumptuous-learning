import type { SubjectId } from "./bank.ts";

export type Subject = {
  id: SubjectId;
  min: number;
  max: number;
  name: (g: number) => string;
  note: (g: number) => string;
  /** false: taught and tracked, but not part of the placement assessment */
  assessed?: boolean;
};

/** Ontario curriculum subject names by grade. Grade 0 = Kindergarten. */
export const SUBJECTS: Subject[] = [
  { id: "lang", min: 0, max: 12,
    name: g => g === 0 ? "Language & Literacy" : g <= 8 ? "Language" : "English",
    note: g => g === 0 ? "Kindergarten frame: Demonstrating Literacy Behaviours" : g <= 8 ? "Ontario Language curriculum" : "English course" },
  { id: "math", min: 0, max: 12,
    name: () => "Mathematics",
    note: g => g === 0 ? "Kindergarten frame: Demonstrating Mathematics Behaviours" : g <= 8 ? "Ontario Mathematics curriculum" : "Mathematics course" },
  { id: "sci", min: 0, max: 12,
    name: g => g === 0 ? "Problem Solving & Innovating" : g <= 8 ? "Science & Technology" : "Science",
    note: g => g === 0 ? "Kindergarten frame" : g <= 8 ? "Ontario Science & Technology curriculum" : g <= 10 ? "Science course" : "Biology, Chemistry & Physics" },
  { id: "soc", min: 0, max: 12,
    name: g => g === 0 ? "Belonging & Contributing" : g <= 6 ? "Social Studies" : g <= 8 ? "History & Geography" : "Canadian & World Studies",
    note: g => g === 0 ? "Kindergarten frame" : g <= 6 ? "Heritage & Identity · People & Environments" : g <= 8 ? "History and Geography strands" : "Geography, History, Civics, Law, Economics" },
  { id: "fsl", min: 4, max: 12, name: () => "French as a Second Language", note: () => "Core French" },
  { id: "arts", min: 0, max: 12, name: () => "The Arts", note: () => "Dance · Drama · Music · Visual Arts" },
  { id: "hpe", min: 0, max: 12,
    name: g => g === 0 ? "Self-Regulation & Well-Being" : "Health & Physical Education",
    note: g => g === 0 ? "Kindergarten frame" : "Healthy Living · Active Living · Movement" },
  { id: "tech", min: 9, max: 12, name: () => "Technological Education", note: () => "Includes Computer Studies" },
  { id: "bus", min: 9, max: 12, name: () => "Business Studies", note: () => "Elective" },
  { id: "ssh", min: 9, max: 12, name: () => "Social Sciences & Humanities", note: () => "Elective" },
  { id: "gce", min: 9, max: 12, name: () => "Guidance & Career Education", note: () => "Includes Career Studies" },
  { id: "ent", min: 0, max: 12, name: () => "Entrepreneurship & Life Skills", note: () => "Presumptuous Project learning strand", assessed: false },
];

/** Subjects the placement assessment covers. */
export const ASSESSED = SUBJECTS.filter(s => s.assessed !== false);

export const SUBJECT_BY_ID = Object.fromEntries(SUBJECTS.map(s => [s.id, s])) as Record<SubjectId, Subject>;

export function subjectsForGrade(g: number): Subject[] {
  return ASSESSED.filter(s => g >= s.min && g <= s.max);
}

export function isSubjectId(x: string): x is SubjectId {
  return x in SUBJECT_BY_ID;
}

export const gradeName = (g: number) => g === 0 ? "Kindergarten" : g === 13 ? "Beyond Grade 12" : `Grade ${g}`;
export const gradeShort = (g: number) => g === 0 ? "K" : g === 13 ? "12+" : String(g);

/** Ontario divisions */
export function divisionOf(g: number): string {
  if (g <= 3) return "Primary";
  if (g <= 6) return "Junior";
  if (g <= 10) return "Intermediate";
  return "Senior";
}

/** "Coach" → "Coaches", "Teacher" → "Teachers" */
export function plural(word: string): string {
  return /(s|x|z|ch|sh)$/i.test(word) ? `${word}es` : `${word}s`;
}
