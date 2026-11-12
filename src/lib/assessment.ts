import { BANK, type Mode, type SubjectId } from "./bank.ts";
import { SUBJECT_BY_ID } from "./subjects.ts";

export type Tier = "below" | "at" | "above";
export type Status = "below" | "at" | "above";

/** A question as the engine sees it. choices[0] is always the correct answer. */
export type BankItem = {
  id: string;
  sid: SubjectId;
  grade: number;
  strand: string;
  skill: string;
  prompt: string;
  choices: [string, string, string, string];
  explanation: string;
};

/**
 * One question as stored on an assessment or practice set.
 * `p` is the grade pool it came from. `qid` identifies it (database id, built-in key, or "gen:…").
 * Phase 1 assessments stored `tier` + `i` (index into the built-in pool) instead of `qid`.
 */
export type StoredQuestion = { sid: SubjectId; p: number; order: number[]; qid?: string; i?: number; tier?: Tier };
/** Original choice index picked; -1 = "I'm not sure yet"; null = unanswered. */
export type Answer = number | null;
export type Lookup = (q: StoredQuestion) => BankItem | undefined;

export type ScoredItem = StoredQuestion & { k: number; tier: Tier; d: BankItem; ans: Answer; ok: boolean };
export type SubjectResult = {
  sid: SubjectId;
  name: string;
  items: ScoredItem[];
  level: 1 | 2 | 3 | 4;
  status: Status;
  /** Grade level the student showed they can work at (adaptive), or an estimate (fixed). -1 = below Kindergarten. */
  working: number;
  correct: number;
  total: number;
};
/** Compact form saved on the assessment when it is completed. */
export type StoredResult = Pick<SubjectResult, "sid" | "level" | "status" | "correct" | "total"> & { working?: number };

export const STATUS_LABEL: Record<Status, string> = { below: "Below grade level", at: "At grade level", above: "Above grade level" };

/* ---------------- built-in bank ---------------- */

export const builtinKey = (sid: SubjectId, p: number, i: number) => `${sid}-${p}-${i}`;

export function builtinItem(sid: SubjectId, p: number, i: number): BankItem | undefined {
  const it = BANK[sid]?.[p]?.[i];
  if (!it) return undefined;
  return { id: builtinKey(sid, p, i), sid, grade: p, strand: it[0], skill: it[1], prompt: it[2], choices: [it[3], it[4], it[5], it[6]], explanation: it[7] ?? "" };
}

/** Lookup against the built-in bank only (tests, demo data, Phase 1 assessments). */
export const builtinLookup: Lookup = q => {
  if (q.i !== undefined) return builtinItem(q.sid, q.p, q.i);
  const m = q.qid && /^([a-z]+)-(\d+)-(\d+)$/.exec(q.qid);
  return m ? builtinItem(m[1] as SubjectId, +m[2], +m[3]) : undefined;
};

export function builtinPool(sid: SubjectId, p: number): BankItem[] {
  return (BANK[sid]?.[p] ?? []).map((_, i) => builtinItem(sid, p, i)!);
}

export function shuffle<T>(a: T[], rng: () => number = Math.random): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

export function toStoredQuestion(item: BankItem, rng: () => number = Math.random): StoredQuestion {
  return { sid: item.sid, p: item.grade, qid: item.id, order: shuffle([0, 1, 2, 3], rng) };
}

/** Phase 1 fixed assessment: 2 from the grade below, 3 at grade, 2 from the grade above. */
export function buildQuestions(g: number, sids: SubjectId[], rng: () => number = Math.random): StoredQuestion[] {
  const qs: StoredQuestion[] = [];
  for (const sid of sids) {
    const add = (p: number, tier: Tier, n: number) =>
      shuffle(builtinPool(sid, p), rng).slice(0, n).forEach(it => qs.push({ ...toStoredQuestion(it, rng), tier }));
    add(g - 1, "below", 2);
    add(g, "at", 3);
    add(g + 1, "above", 2);
  }
  return qs;
}

/** The question as a student sees it: no hint of which option is correct. */
export function publicQuestion(q: StoredQuestion, item: BankItem, grade: number) {
  return { subject: SUBJECT_BY_ID[q.sid].name(grade), strand: item.strand, prompt: item.prompt, options: q.order.map(oi => item.choices[oi]) };
}
export type PublicQuestion = ReturnType<typeof publicQuestion>;

/* ---------------- adaptive engine ---------------- */

export const STAGE_SIZE = 3;
export const MAX_STEPS = 3; // how far above or below the student's grade we go
const passed = (c: number, n: number) => n > 0 && c >= Math.ceil(n * 0.6);

type Stage = { p: number; correct: number; n: number };

function stagesOf(results: { p: number; ok: boolean }[]): Stage[] {
  const out: Stage[] = [];
  for (const r of results) {
    const last = out[out.length - 1];
    if (last && last.p === r.p) { last.n++; if (r.ok) last.correct++; }
    else out.push({ p: r.p, n: 1, correct: r.ok ? 1 : 0 });
  }
  return out;
}

/**
 * Which grade pool to test next for one subject, or null when the subject is finished.
 * Start at the student's grade. Pass → go up a grade until a stage is failed. Fail → go down until one is passed.
 */
export function nextStagePool(grade: number, answered: { p: number; ok: boolean }[], hasPool: (p: number) => boolean): number | null {
  const st = stagesOf(answered);
  if (!st.length) return hasPool(grade) ? grade : null;
  const last = st[st.length - 1];
  const ok = passed(last.correct, last.n);
  const goingUp = st.length === 1 ? ok : st[1].p > st[0].p;
  let next: number | null = null;
  if (goingUp && ok && last.p < grade + MAX_STEPS) next = last.p + 1;
  if (!goingUp && !ok && last.p > grade - MAX_STEPS) next = last.p - 1;
  return next !== null && next >= 0 && next <= 13 && hasPool(next) ? next : null;
}

/** Grade level shown: the highest stage passed going up, or the first passed going down. */
export function workingLevel(grade: number, answered: { p: number; ok: boolean }[]): number {
  const st = stagesOf(answered);
  if (!st.length) return grade - 1;
  const passedPools = st.filter(s => passed(s.correct, s.n)).map(s => s.p);
  const atGrade = st.find(s => s.p === grade);
  if (atGrade && passed(atGrade.correct, atGrade.n)) return Math.max(...passedPools.filter(p => p >= grade));
  const below = passedPools.filter(p => p < grade);
  if (below.length) return Math.max(...below);
  return Math.min(...st.map(s => s.p)) - 1;
}

const levelFor = (working: number, grade: number): 1 | 2 | 3 | 4 => {
  const d = working - grade;
  return d >= 1 ? 4 : d === 0 ? 3 : d === -1 ? 2 : 1;
};
const statusFor = (level: number): Status => level === 4 ? "above" : level === 3 ? "at" : "below";

/* ---------------- scoring ---------------- */

/** Phase 1 fixed scoring (tiers). */
function scoreFixed(items: ScoredItem[]): { level: 1 | 2 | 3 | 4 } {
  const t = (tier: Tier): [number, number] => { const a = items.filter(x => x.tier === tier); return [a.filter(x => x.ok).length, a.length]; };
  const bl = t("below"), at = t("at"), ab = t("above");
  if ((at[0] >= 2 && ab[1] > 0 && ab[0] === ab[1]) || (at[0] === at[1] && at[1] > 0 && ab[0] >= 1)) return { level: 4 };
  if (at[0] >= 2) return { level: 3 };
  if (at[0] === 1 || (bl[1] > 0 && bl[0] === bl[1])) return { level: 2 };
  return { level: 1 };
}

export function scoreAssessment(
  grade: number, subjects: SubjectId[], questions: StoredQuestion[], answers: Answer[],
  lookup: Lookup = builtinLookup, mode: "fixed" | "adaptive" = "fixed",
): SubjectResult[] {
  const all: ScoredItem[] = [];
  questions.forEach((q, k) => {
    const d = lookup(q);
    if (!d) return;
    const tier: Tier = q.tier ?? (q.p < grade ? "below" : q.p > grade ? "above" : "at");
    all.push({ ...q, k, tier, d, ans: answers[k] ?? null, ok: answers[k] === 0 });
  });
  return subjects.map(sid => {
    const items = all.filter(x => x.sid === sid);
    let level: 1 | 2 | 3 | 4, working: number;
    if (mode === "adaptive") {
      working = workingLevel(grade, items.map(x => ({ p: x.p, ok: x.ok })));
      level = levelFor(working, grade);
    } else {
      level = scoreFixed(items).level;
      working = grade + (level === 4 ? 1 : level === 3 ? 0 : level === 2 ? -1 : -2);
    }
    const correct = items.filter(x => x.ok).length;
    return { sid, name: SUBJECT_BY_ID[sid].name(grade), items, level, status: statusFor(level), working, correct, total: items.length };
  });
}

export function toStored(rs: SubjectResult[]): StoredResult[] {
  return rs.map(({ sid, level, status, correct, total, working }) => ({ sid, level, status, correct, total, working }));
}

export type Focus = { skill: string; mode: Mode; grade: number };

/**
 * Skills to work on, in priority order.
 * `skillsAt(p)` lists the skills available in the bank for grade pool p.
 */
export function focusFor(r: SubjectResult, grade: number, skillsAt: (p: number) => string[] = p => builtinPool(r.sid, p).map(x => x.skill)): Focus[] {
  const out: Focus[] = [];
  const seen = new Set<string>();
  const push = (skill: string, mode: Mode, g: number) => { if (!seen.has(skill)) { seen.add(skill); out.push({ skill, mode, grade: g }); } };
  const missed = (pred: (x: ScoredItem) => boolean) => r.items.filter(x => !x.ok && pred(x));
  const w = Math.max(0, Math.min(13, r.working));
  if (r.status === "below") {
    missed(x => x.p <= grade).sort((a, b) => a.p - b.p).forEach(x => push(x.d.skill, "repair", x.p));
    skills(w + 1).forEach(s => push(s, "repair", w + 1));
    skills(grade).forEach(s => push(s, "practice", grade));
    skills(grade + 1).forEach(s => push(s, "stretch", grade + 1));
  } else if (r.status === "at") {
    missed(x => x.p <= grade).forEach(x => push(x.d.skill, "practice", x.p));
    missed(x => x.p > grade).forEach(x => push(x.d.skill, "stretch", x.p));
    skills(grade + 1).forEach(s => push(s, "stretch", grade + 1));
    skills(grade + 2).forEach(s => push(s, "stretch", grade + 2));
  } else {
    missed(x => x.p <= grade).forEach(x => push(x.d.skill, "practice", x.p));
    missed(x => x.p > grade).forEach(x => push(x.d.skill, "stretch", x.p));
    skills(w + 1).forEach(s => push(s, "stretch", w + 1));
    skills(grade + 2).forEach(s => push(s, "stretch", grade + 2));
  }
  if (!out.length) push("an independent inquiry project", "stretch", grade + 1);
  return out;
  function skills(p: number) { return p >= 0 && p <= 13 ? skillsAt(p) : []; }
}
