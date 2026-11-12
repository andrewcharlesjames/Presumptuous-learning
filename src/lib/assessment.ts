import { BANK, type Item, type Mode, type SubjectId } from "./bank.ts";
import { SUBJECT_BY_ID } from "./subjects.ts";

export type Tier = "below" | "at" | "above";
export type Status = "below" | "at" | "above";

/** One question as stored on an assessment. `order` is the display order of the 4 options (0 = correct). */
export type StoredQuestion = { sid: SubjectId; tier: Tier; p: number; i: number; order: number[] };
/** Original option index chosen; -1 = "I'm not sure yet"; null = unanswered. */
export type Answer = number | null;

export type ScoredItem = StoredQuestion & { k: number; d: Item; ans: Answer; ok: boolean };
export type SubjectResult = {
  sid: SubjectId;
  name: string;
  items: ScoredItem[];
  bl: [number, number];
  at: [number, number];
  ab: [number, number];
  level: 1 | 2 | 3 | 4;
  status: Status;
  correct: number;
  total: number;
};
/** Compact form saved on the assessment when it is completed. */
export type StoredResult = Pick<SubjectResult, "sid" | "level" | "status" | "correct" | "total">;

export const STATUS_LABEL: Record<Status, string> = { below: "Below grade level", at: "At grade level", above: "Above grade level" };

export function pool(sid: SubjectId, p: number): Item[] {
  return BANK[sid]?.[p] ?? [];
}

export function shuffle<T>(a: T[], rng: () => number = Math.random): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

export function buildQuestions(g: number, sids: SubjectId[], rng: () => number = Math.random): StoredQuestion[] {
  const qs: StoredQuestion[] = [];
  for (const sid of sids) {
    const add = (p: number, tier: Tier, n: number) => {
      shuffle(pool(sid, p).map((_, i) => i), rng).slice(0, n).forEach(i => {
        qs.push({ sid, tier, p, i, order: shuffle([0, 1, 2, 3], rng) });
      });
    };
    add(g - 1, "below", 2);
    add(g, "at", 3);
    add(g + 1, "above", 2);
  }
  return qs;
}

export function questionItem(q: StoredQuestion): Item | undefined {
  return pool(q.sid, q.p)[q.i];
}

/** The question as a student sees it: no hint of which option is correct. */
export function publicQuestion(q: StoredQuestion, grade: number) {
  const d = questionItem(q)!;
  return {
    subject: SUBJECT_BY_ID[q.sid].name(grade),
    strand: d[0],
    prompt: d[2],
    options: q.order.map(oi => d[3 + oi]),
  };
}

/**
 * Scoring per subject (Ontario achievement levels):
 *  Level 4 / Above: ≥2 of 3 grade-level AND every next-grade item, or 3/3 grade-level + ≥1 next-grade
 *  Level 3 / At:    ≥2 of 3 grade-level
 *  Level 2 / Below: 1 of 3 grade-level, or every previous-grade item
 *  Level 1 / Below: otherwise
 */
export function scoreSubject(sid: SubjectId, grade: number, items: ScoredItem[]): SubjectResult {
  const t = (tier: Tier): [number, number] => {
    const a = items.filter(x => x.tier === tier);
    return [a.filter(x => x.ok).length, a.length];
  };
  const bl = t("below"), at = t("at"), ab = t("above");
  let level: 1 | 2 | 3 | 4;
  if ((at[0] >= 2 && ab[1] > 0 && ab[0] === ab[1]) || (at[0] === at[1] && at[1] > 0 && ab[0] >= 1)) level = 4;
  else if (at[0] >= 2) level = 3;
  else if (at[0] === 1 || (bl[1] > 0 && bl[0] === bl[1])) level = 2;
  else level = 1;
  const status: Status = level === 4 ? "above" : level === 3 ? "at" : "below";
  const correct = items.filter(x => x.ok).length;
  return { sid, name: SUBJECT_BY_ID[sid].name(grade), items, bl, at, ab, level, status, correct, total: items.length };
}

export function scoreAssessment(grade: number, subjects: SubjectId[], questions: StoredQuestion[], answers: Answer[]): SubjectResult[] {
  const all: ScoredItem[] = questions
    .map((q, k) => ({ ...q, k, d: questionItem(q)!, ans: answers[k] ?? null, ok: answers[k] === 0 }))
    .filter(x => x.d);
  return subjects.map(sid => scoreSubject(sid, grade, all.filter(x => x.sid === sid)));
}

export function toStored(rs: SubjectResult[]): StoredResult[] {
  return rs.map(({ sid, level, status, correct, total }) => ({ sid, level, status, correct, total }));
}

export type Focus = { skill: string; mode: Mode };

/** Skills to work on, in priority order, based on what the student missed. */
export function focusFor(r: SubjectResult, grade: number): Focus[] {
  const out: Focus[] = [];
  const seen = new Set<string>();
  const push = (skill: string, mode: Mode) => { if (!seen.has(skill)) { seen.add(skill); out.push({ skill, mode }); } };
  const missed = (tier: Tier) => r.items.filter(x => x.tier === tier && !x.ok).map(x => x.d[1]);
  const skills = (p: number) => pool(r.sid, p).map(q => q[1]);
  if (r.status === "below") {
    missed("below").forEach(s => push(s, "repair"));
    missed("at").forEach(s => push(s, "repair"));
    skills(grade).forEach(s => push(s, "practice"));
    skills(grade + 1).forEach(s => push(s, "stretch"));
  } else if (r.status === "at") {
    missed("at").forEach(s => push(s, "practice"));
    missed("above").forEach(s => push(s, "stretch"));
    skills(grade + 1).forEach(s => push(s, "stretch"));
    skills(grade + 2).forEach(s => push(s, "stretch"));
  } else {
    missed("at").forEach(s => push(s, "practice"));
    missed("above").forEach(s => push(s, "stretch"));
    skills(grade + 2).forEach(s => push(s, "stretch"));
    skills(grade + 1).forEach(s => push(s, "stretch"));
  }
  if (!out.length) push("an independent inquiry project", "stretch");
  return out;
}
