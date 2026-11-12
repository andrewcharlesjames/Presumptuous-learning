import "server-only";
import type { Question } from "@prisma/client";
import { db } from "./db";
import { BANK, type SubjectId } from "./bank";
import { builtinKey, builtinLookup, type BankItem, type Lookup, type StoredQuestion } from "./assessment";
import { generatedItem, isGeneratedId } from "./generators";

let seeding: Promise<void> | null = null;

/** Adds any built-in questions missing from the database. Never overwrites edits. Runs once per server process. */
export function ensureBankSeeded(): Promise<void> {
  seeding ??= (async () => {
    const data = (Object.entries(BANK) as [SubjectId, Record<number, string[][]>][]).flatMap(([sid, pools]) =>
      Object.entries(pools).flatMap(([p, items]) => items.map((it, i) => ({
        key: builtinKey(sid, +p, i), subject: sid, grade: +p, strand: it[0], skill: it[1], prompt: it[2],
        correct: it[3], wrong1: it[4], wrong2: it[5], wrong3: it[6], source: "builtin",
      }))));
    await db.question.createMany({ data, skipDuplicates: true });
  })().catch(e => { seeding = null; throw e; });
  return seeding;
}

export function toItem(q: Question): BankItem {
  return {
    id: q.id, sid: q.subject as SubjectId, grade: q.grade, strand: q.strand, skill: q.skill, prompt: q.prompt,
    choices: [q.correct, q.wrong1, q.wrong2, q.wrong3], explanation: q.explanation,
  };
}

/** Active questions for one subject and grade pool. */
export async function poolItems(sid: SubjectId, p: number): Promise<BankItem[]> {
  await ensureBankSeeded();
  const rows = await db.question.findMany({ where: { subject: sid, grade: p, active: true } });
  return rows.map(toItem);
}

/** Which grade pools have at least `min` active questions, per subject. */
export async function poolCounts(): Promise<Map<string, number>> {
  await ensureBankSeeded();
  const rows = await db.question.groupBy({ by: ["subject", "grade"], where: { active: true }, _count: true });
  return new Map(rows.map(r => [`${r.subject}:${r.grade}`, r._count]));
}

/** Skills available at each grade for a subject (for plans and next-level requirements). */
export async function skillIndex(sids: SubjectId[]): Promise<(sid: SubjectId) => (p: number) => string[]> {
  await ensureBankSeeded();
  const rows = await db.question.findMany({ where: { subject: { in: sids }, active: true }, select: { subject: true, grade: true, skill: true }, orderBy: { createdAt: "asc" } });
  const map = new Map<string, string[]>();
  for (const r of rows) {
    const k = `${r.subject}:${r.grade}`;
    const list = map.get(k) ?? [];
    if (!list.includes(r.skill)) list.push(r.skill);
    map.set(k, list);
  }
  return sid => p => map.get(`${sid}:${p}`) ?? [];
}

/**
 * Builds a lookup for the questions on an assessment or practice set.
 * Resolves database ids, built-in keys (and Phase 1 index-based questions), and generated questions,
 * including questions that have since been retired.
 */
export async function lookupFor(questions: StoredQuestion[]): Promise<Lookup> {
  await ensureBankSeeded();
  const ids = [...new Set(questions.map(q => q.qid).filter((x): x is string => !!x && !isGeneratedId(x)))];
  const keys = questions.filter(q => q.i !== undefined).map(q => builtinKey(q.sid, q.p, q.i!));
  const rows = await db.question.findMany({ where: { OR: [{ id: { in: ids } }, { key: { in: [...ids, ...keys] } }] } });
  const byId = new Map<string, BankItem>();
  for (const r of rows) { const it = toItem(r); byId.set(r.id, it); byId.set(r.key, it); }
  return q => {
    if (q.qid && isGeneratedId(q.qid)) return generatedItem(q.qid);
    if (q.qid && byId.has(q.qid)) return byId.get(q.qid);
    if (q.i !== undefined) return byId.get(builtinKey(q.sid, q.p, q.i)) ?? builtinLookup(q);
    return builtinLookup(q);
  };
}
