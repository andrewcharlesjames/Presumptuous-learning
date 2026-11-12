import "server-only";
import type { Assessment } from "@prisma/client";
import { db } from "./db";
import type { SubjectId } from "./bank";
import {
  nextStagePool, publicQuestion, shuffle, STAGE_SIZE, toStoredQuestion,
  type Answer, type BankItem, type PublicQuestion, type StoredQuestion,
} from "./assessment";
import { lookupFor, poolCounts, poolItems } from "./questions";
import { GENERATORS, generateMath } from "./generators";

/** Up to `n` questions for one subject and grade, spread across skills, avoiding ones already used. */
export async function pickItems(sid: SubjectId, p: number, n: number, exclude: Set<string>, preferSkill?: string): Promise<BankItem[]> {
  const bank = (await poolItems(sid, p)).filter(x => !exclude.has(x.id));
  const generated: BankItem[] = [];
  if (sid === "math") for (let k = 0; k < 3; k++) { const g = generateMath(p, k === 0 ? preferSkill : undefined); if (g) generated.push(g); }
  const all = shuffle([...bank, ...generated]);
  const picked: BankItem[] = [];
  const skills = new Set<string>();
  // first: the preferred skill; then one per skill; then anything
  for (const x of all) if (picked.length < n && preferSkill && x.skill === preferSkill && !picked.includes(x)) { picked.push(x); skills.add(x.skill); }
  for (const x of all) if (picked.length < n && !skills.has(x.skill) && !picked.includes(x)) { picked.push(x); skills.add(x.skill); }
  for (const x of all) if (picked.length < n && !picked.includes(x)) picked.push(x);
  return picked;
}

export async function hasPoolFn() {
  const counts = await poolCounts();
  return (sid: SubjectId) => (p: number) => (counts.get(`${sid}:${p}`) ?? 0) > 0 || (sid === "math" && GENERATORS.some(g => g.grade === p));
}

/**
 * Adds the next stage of questions to an adaptive assessment if every question so far is answered.
 * Returns true when the assessment has no more questions to ask.
 */
export async function advance(a: Pick<Assessment, "id" | "grade" | "subjects" | "questions" | "answers">): Promise<{ done: boolean; questions: StoredQuestion[]; answers: Answer[] }> {
  const questions = (a.questions as StoredQuestion[]).slice();
  const answers = (a.answers as Answer[]).slice();
  if (answers.some(x => x === null)) return { done: false, questions, answers };
  const subjects = a.subjects as SubjectId[];
  const has = await hasPoolFn();
  const used = new Set(questions.map(q => q.qid ?? ""));
  let si = questions.length ? subjects.indexOf(questions[questions.length - 1].sid) : 0;
  for (; si < subjects.length; si++) {
    const sid = subjects[si];
    const answered = questions.map((q, k) => ({ q, k })).filter(x => x.q.sid === sid).map(x => ({ p: x.q.p, ok: answers[x.k] === 0 }));
    const next = nextStagePool(a.grade, answered, has(sid));
    if (next === null) continue;
    const items = await pickItems(sid, next, STAGE_SIZE, used);
    if (!items.length) continue;
    for (const it of items) { questions.push(toStoredQuestion(it)); answers.push(null); }
    await db.assessment.update({ where: { id: a.id }, data: { questions, answers } });
    return { done: false, questions, answers };
  }
  return { done: true, questions, answers };
}

/** What the student sees next: the first unanswered question, with progress. */
export async function currentView(a: Pick<Assessment, "grade" | "subjects">, questions: StoredQuestion[], answers: Answer[]): Promise<{
  index: number; question: PublicQuestion; subjectNumber: number; subjectCount: number; inSubject: number;
} | null> {
  const index = answers.findIndex(x => x === null);
  if (index < 0) return null;
  const q = questions[index];
  const lookup = await lookupFor([q]);
  const item = lookup(q);
  if (!item) return null;
  const subjects = a.subjects as SubjectId[];
  return {
    index,
    question: publicQuestion(q, item, a.grade),
    subjectNumber: subjects.indexOf(q.sid) + 1,
    subjectCount: subjects.length,
    inSubject: questions.slice(0, index + 1).filter(x => x.sid === q.sid).length,
  };
}
