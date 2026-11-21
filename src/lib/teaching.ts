import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { db } from "./db";
import { TUTOR_MODEL, tutorConfigured } from "./tutor";
import { gradeName, SUBJECT_BY_ID, isSubjectId } from "./subjects";

/**
 * Teaching notes for every question, so feedback always teaches:
 * why the right answer is right, and why each wrong answer is wrong.
 * Written by AI once per question and stored; nothing about any student is sent.
 */
const Notes = z.object({
  explanation: z.string(),
  whyWrong: z.array(z.string()),
});

const SYSTEM = `You write the feedback a student sees after answering a multiple-choice question on a learning platform for Ontario students, Kindergarten to Grade 12.

For the question you are given, write:
- explanation: one or two short sentences saying why the correct answer is right, teaching the idea (for example, the rule, the step, or the meaning), not just restating the answer.
- whyWrong: exactly one short sentence for each wrong answer, in the order given, naming the likely mistake or misunderstanding that leads to that choice and the key fact that shows it is wrong.

Rules:
- Match the student's grade: very simple words for Kindergarten to Grade 3.
- Refer to answers by what they say, never by letter or position.
- Be warm and direct. No praise filler, no questions to the student.
- Always spell practice with a c in every form (practice, practiced, practicing).
- Plain text only.`;

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

type Q = { id: string; subject: string; grade: number; strand: string; skill: string; prompt: string; correct: string; wrong1: string; wrong2: string; wrong3: string; explanation: string };

export async function writeNotes(q: Q): Promise<{ explanation: string; whyWrong: string[] } | null> {
  const subject = isSubjectId(q.subject) ? SUBJECT_BY_ID[q.subject].name(q.grade) : q.subject;
  const user = `Grade: ${gradeName(q.grade)}
Subject: ${subject} (${q.strand}: ${q.skill})
Question: ${q.prompt}
Correct answer: ${q.correct}
Wrong answers, in order:
1. ${q.wrong1}
2. ${q.wrong2}
3. ${q.wrong3}${q.explanation ? `\nExisting explanation (improve it if it doesn't teach why): ${q.explanation}` : ""}`;
  try {
    const response = await getClient().beta.messages.parse({
      model: TUTOR_MODEL,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(Notes) },
      system: SYSTEM,
      messages: [{ role: "user", content: user }],
    });
    const out = response.parsed_output;
    if (response.stop_reason === "refusal" || !out || out.whyWrong.length < 3 || !out.explanation.trim()) return null;
    return { explanation: out.explanation.trim().slice(0, 1000), whyWrong: out.whyWrong.slice(0, 3).map(s => s.trim().slice(0, 500)) };
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) throw error; // stop the run; try again next time
    if (error instanceof Anthropic.APIError) console.error(`teaching notes: API error ${error.status}`);
    else console.error("teaching notes: failed", error);
    return null;
  }
}

/** Questions still missing teaching notes. */
export const missingNotesWhere = { whyWrong: { isEmpty: true } } as const;

let running: Promise<{ done: number; failed: number }> | null = null;
export const notesRunning = () => running !== null;

/**
 * Fills in teaching notes for up to `limit` questions, a few at a time. Safe to call often:
 * only one run at a time, and questions that already have notes are skipped.
 */
export function fillTeachingNotes(limit = 40): Promise<{ done: number; failed: number }> {
  if (!tutorConfigured()) return Promise.resolve({ done: 0, failed: 0 });
  if (running) return running;
  running = (async () => {
    let done = 0, failed = 0;
    const todo = await db.question.findMany({ where: missingNotesWhere, orderBy: [{ active: "desc" }, { grade: "asc" }], take: limit });
    for (let i = 0; i < todo.length; i += 4) {
      const batch = todo.slice(i, i + 4);
      try {
        const results = await Promise.all(batch.map(q => writeNotes(q)));
        for (const [k, r] of results.entries()) {
          if (!r) { failed++; continue; }
          await db.question.update({ where: { id: batch[k].id }, data: { explanation: r.explanation, whyWrong: r.whyWrong } });
          done++;
        }
      } catch {
        break; // rate limited: carry on next run
      }
    }
    return { done, failed };
  })().finally(() => { running = null; });
  return running;
}
