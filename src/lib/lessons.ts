import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { Prisma, type Lesson } from "@prisma/client";
import { db } from "./db";
import type { SubjectId } from "./bank";
import type { BankItem } from "./assessment";
import { SUBJECT_BY_ID, gradeName } from "./subjects";
import { TUTOR_MODEL, tutorConfigured } from "./tutor";

/**
 * Lessons: one short lesson per skill and grade, written once by AI and shared by every student.
 * Variant 1 teaches the skill; variants 2 and 3 reteach it a different way after a missed mastery check.
 * Each lesson carries its own "try it" question and five mastery-check questions.
 */
const Question = z.object({ prompt: z.string(), correct: z.string(), wrong: z.array(z.string()), explanation: z.string() });
export const LessonSchema = z.object({
  title: z.string(),
  whyItMatters: z.string(),
  explanation: z.array(z.string()),
  examples: z.array(z.object({ problem: z.string(), steps: z.array(z.string()), answer: z.string() })),
  commonMistake: z.string(),
  tryIt: Question,
  checkQuestions: z.array(Question),
});
export type LessonContent = z.infer<typeof LessonSchema>;
export const MAX_VARIANT = 3;
export const MASTERY_SET = 5;
export const MASTERY_PASS = 4;

const SYSTEM = `You write short lessons for a learning platform used in Ontario schools, Kindergarten to Grade 12.
The platform has already assessed the student. Each lesson teaches exactly one skill, at one grade level, so the student can then pass a 5-question check on it.

Write for the student, in second person, with Canadian spelling, metric units and Canadian contexts where natural.
- title: the skill, in a few words.
- whyItMatters: one sentence connecting the skill to real life.
- explanation: 2 to 4 short paragraphs (each 1 to 3 sentences) that build the idea step by step. For Kindergarten to Grade 2, use very simple words; a grown-up will read it aloud.
- examples: exactly 2 worked examples, each with a problem, 2 to 4 numbered-in-order steps, and the answer.
- commonMistake: one mistake students often make with this skill and how to avoid it.
- tryIt: one multiple-choice question with 1 correct and exactly 3 wrong answers, plus a one-sentence explanation.
- checkQuestions: exactly 5 new multiple-choice questions on this same skill, at this grade, each with 1 correct answer, exactly 3 wrong answers based on real misconceptions, and a one-sentence explanation. Vary them; do not reuse the examples or the tryIt question.
Always spell practice with a c in every form (practice, practiced, practicing), including as a verb.
Everything must be accurate and match the Ontario curriculum for the grade. No images, diagrams, links or markdown. Questions must be self-contained text.`;

const VARIANT_NOTE: Record<number, string> = {
  1: "This is the first time the student is being taught this skill.",
  2: "The student did not pass the check after the first lesson. Teach it again a different way: smaller steps, simpler words, and an everyday comparison they will recognize. Use new examples and new questions.",
  3: "The student has not passed after two lessons. Use a different approach again: a hands-on or visual way of thinking about it (described in words), the most basic building block first, then build up. Use new examples and new questions.",
};

export function lessonQuestionKey(lessonId: string, n: number) {
  return `lesson-${lessonId}-${n}`;
}

const generating = new Map<string, Promise<Lesson | null>>();

/** Find a lesson, or write it with AI if it doesn't exist yet. Returns null if AI isn't configured or fails. */
export function getOrCreateLesson(subject: SubjectId, grade: number, skill: string, variant: number, strand?: string): Promise<Lesson | null> {
  const key = `${subject}:${grade}:${skill}:${variant}`;
  const running = generating.get(key);
  if (running) return running;
  const p = (async () => {
    const existing = await db.lesson.findUnique({ where: { subject_grade_skill_variant: { subject, grade, skill, variant } } });
    if (existing?.active) return existing;
    if (!tutorConfigured()) return null;
    const content = await writeLesson(subject, grade, skill, variant, strand);
    if (!content) return null;
    try {
      const lesson = existing
        ? await db.lesson.update({ where: { id: existing.id }, data: { content, active: true, reviewed: false, model: TUTOR_MODEL } })
        : await db.lesson.create({ data: { subject, grade, skill, variant, content, model: TUTOR_MODEL } });
      await saveCheckQuestions(lesson, content, strand ?? skill);
      return lesson;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return db.lesson.findUnique({ where: { subject_grade_skill_variant: { subject, grade, skill, variant } } });
      }
      throw e;
    }
  })().finally(() => generating.delete(key));
  generating.set(key, p);
  return p;
}

async function writeLesson(subject: SubjectId, grade: number, skill: string, variant: number, strand?: string): Promise<LessonContent | null> {
  const level = grade === 13 ? "first-year college or university (beyond Grade 12)" : gradeName(grade);
  const user = `Subject: ${SUBJECT_BY_ID[subject].name(grade)}${strand ? ` (strand: ${strand})` : ""}
Grade: ${level}
Skill: ${skill}
${VARIANT_NOTE[variant] ?? VARIANT_NOTE[3]}${subject === "ent" ? `
This is the Presumptuous Project's Entrepreneurship & Life Skills strand. Every student runs a real small business this year. It is taught earlier than the Ontario curriculum on purpose, so keep it concrete and kid-sized for young grades (lemonade stands, bake sales, dog walking), use Canadian dollars, never suggest anything unsafe or that involves meeting strangers alone, and end the explanation by showing how the student can use this skill on their own small business.` : ""}`;
  try {
    const client = new Anthropic();
    const response = await client.beta.messages.parse({
      model: TUTOR_MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(LessonSchema) },
      system: SYSTEM,
      messages: [{ role: "user", content: user }],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) return null;
    return clean(response.parsed_output);
  } catch (error) {
    if (error instanceof Anthropic.APIError) console.error(`lesson: API error ${error.status}`);
    else console.error("lesson: generation failed", error);
    return null;
  }
}

/** Keep only well-formed questions (1 correct + 3 distinct wrong answers). */
function clean(c: LessonContent): LessonContent | null {
  const ok = (q: z.infer<typeof Question>) => {
    const choices = [q.correct, ...q.wrong].map(s => s.trim());
    return q.prompt.trim() && q.wrong.length >= 3 && new Set(choices.slice(0, 4)).size === 4 && choices.slice(0, 4).every(Boolean);
  };
  const fix = (q: z.infer<typeof Question>) => ({ ...q, wrong: q.wrong.slice(0, 3) });
  const checks = c.checkQuestions.filter(ok).map(fix);
  if (!ok(c.tryIt) || checks.length < 3 || !c.explanation.length) return null;
  return { ...c, tryIt: fix(c.tryIt), checkQuestions: checks.slice(0, MASTERY_SET), examples: c.examples.slice(0, 3) };
}

/** Lesson check questions live in the question table (inactive) so practice sets and scoring can use them. */
async function saveCheckQuestions(lesson: Lesson, c: LessonContent, strand: string) {
  await db.question.deleteMany({ where: { key: { startsWith: `lesson-${lesson.id}-` } } });
  await db.question.createMany({
    data: c.checkQuestions.map((q, n) => ({
      key: lessonQuestionKey(lesson.id, n), subject: lesson.subject, grade: lesson.grade, strand: strand.slice(0, 80),
      skill: lesson.skill, prompt: q.prompt, correct: q.correct, wrong1: q.wrong[0], wrong2: q.wrong[1], wrong3: q.wrong[2],
      explanation: q.explanation, active: false, source: "lesson",
    })),
  });
}

/** The mastery-check questions written with a lesson. */
export async function lessonCheckItems(lessonId: string): Promise<BankItem[]> {
  const rows = await db.question.findMany({ where: { key: { startsWith: `lesson-${lessonId}-` } }, orderBy: { key: "asc" } });
  return rows.map(r => ({
    id: r.id, sid: r.subject as SubjectId, grade: r.grade, strand: r.strand, skill: r.skill, prompt: r.prompt,
    choices: [r.correct, r.wrong1, r.wrong2, r.wrong3], explanation: r.explanation,
  }));
}

export function lessonContent(l: Lesson): LessonContent {
  return l.content as unknown as LessonContent;
}
