import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "./db";
import type { BankItem } from "./assessment";
import { gradeName, SUBJECT_BY_ID } from "./subjects";

/**
 * AI tutor: explains why an answer was wrong, in a few plain sentences for the student's grade.
 * Privacy: only the question, its choices, the chosen answer and the grade are sent. Never names or ids.
 */
export const TUTOR_MODEL = "claude-opus-5-5";
export const DAILY_LIMIT = 30;

export function tutorConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

const SYSTEM = `You are a patient tutor inside a learning platform for Ontario students from Kindergarten to Grade 12.
A student answered a multiple-choice practice question incorrectly (or chose "not sure yet"). Explain the idea so they can get it right next time.

Rules:
- Write 2 to 4 short sentences in plain language suited to the student's grade. For Grades K–3, use very simple words.
- Explain why the correct answer is right. If the student picked a wrong answer, say briefly what mistake leads to that choice.
- Show a short worked step for math, or one concrete example for other subjects.
- Be warm and encouraging without praise filler. Do not ask the student questions or for any personal information.
- Refer to answers by what they say, never by letter: the student saw them in a different order.
- Only discuss this question. Plain text only: no headings, lists or markdown.`;

export type TutorResult = { ok: true; text: string } | { ok: false; reason: "off" | "limit" | "error" };

export async function explain(item: BankItem, chosen: number, grade: number, studentId: string): Promise<TutorResult> {
  if (!tutorConfigured()) return { ok: false, reason: "off" };
  const key = `${item.id}:${chosen}`;
  const cached = await db.tutorExplanation.findUnique({ where: { key } });
  if (cached) return { ok: true, text: cached.text };

  const since = new Date(Date.now() - 86400000);
  const used = await db.tutorRequest.count({ where: { studentId, createdAt: { gte: since } } });
  if (used >= DAILY_LIMIT) return { ok: false, reason: "limit" };
  await db.tutorRequest.create({ data: { studentId } });

  const letters = ["A", "B", "C", "D"];
  const choiceLines = item.choices.map((c, i) => `${letters[i]}. ${c}${i === 0 ? " (correct)" : ""}`).join("\n");
  const picked = chosen === -1 ? "The student chose “I'm not sure yet”." : `The student chose ${letters[chosen]}: ${item.choices[chosen]}.`;
  const user = `Student's grade: ${gradeName(grade)}
Subject: ${SUBJECT_BY_ID[item.sid].name(grade)} (${item.strand}: ${item.skill})
Question: ${item.prompt}
Choices:
${choiceLines}
${picked}`;

  try {
    const response = await getClient().beta.messages.create({
      model: TUTOR_MODEL,
      max_tokens: 1500,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: SYSTEM,
      messages: [{ role: "user", content: user }],
    });
    if (response.stop_reason === "refusal") return { ok: false, reason: "error" };
    const text = response.content
      .flatMap(b => (b.type === "text" ? [b.text] : []))
      .join(" ")
      .trim();
    if (!text) return { ok: false, reason: "error" };
    await db.tutorExplanation.upsert({ where: { key }, create: { key, text, model: response.model }, update: {} });
    return { ok: true, text };
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) console.error("tutor: rate limited");
    else if (error instanceof Anthropic.AuthenticationError) console.error("tutor: ANTHROPIC_API_KEY is invalid");
    else if (error instanceof Anthropic.APIError) console.error(`tutor: API error ${error.status}`);
    else console.error("tutor: request failed", error);
    return { ok: false, reason: "error" };
  }
}
