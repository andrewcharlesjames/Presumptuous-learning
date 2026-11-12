import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { db } from "./db";
import type { SubjectId } from "./bank";
import { SUBJECT_BY_ID, gradeName } from "./subjects";
import { TUTOR_MODEL, tutorConfigured } from "./tutor";

/**
 * AI-assisted question drafting for the platform admin. Drafts are saved inactive (students never see them)
 * until an admin approves each one in the question bank.
 */
const Draft = z.object({
  questions: z.array(z.object({
    strand: z.string(),
    skill: z.string(),
    prompt: z.string(),
    correct: z.string(),
    wrong: z.array(z.string()),
    explanation: z.string(),
  })),
});

const SYSTEM = `You write multiple-choice questions for a placement and practice platform used in Ontario schools (Kindergarten to Grade 12).
Each question must:
- match an expectation in the Ontario curriculum for the given subject and grade;
- have exactly one correct answer and exactly three wrong answers, each based on a real misconception students at that grade have;
- use Canadian spelling and Canadian or Ontario contexts where natural (metric units, dollars);
- be self-contained (no images or diagrams), short, and readable for the grade;
- include a one- or two-sentence explanation a student sees after answering.
Always spell practice with a c in every form (practice, practiced, practicing), including as a verb.
Never repeat or closely paraphrase an existing question you are shown. Spread the new questions across different skills.`;

export async function draftQuestions(subject: SubjectId, grade: number, count = 5): Promise<{ created: number; error?: string }> {
  if (!tutorConfigured()) return { created: 0, error: "Add ANTHROPIC_API_KEY on the server to use AI drafting." };
  const existing = await db.question.findMany({ where: { subject, grade }, select: { prompt: true, skill: true, strand: true } });
  const name = SUBJECT_BY_ID[subject].name(grade);
  const level = grade === 13 ? "first-year college or university (beyond Grade 12)" : gradeName(grade);
  const user = `Subject: ${name}
Grade: ${level}
Strands already used: ${[...new Set(existing.map(e => e.strand))].join("; ") || "none yet"}
Existing questions (do not repeat):
${existing.map(e => `- [${e.skill}] ${e.prompt}`).join("\n") || "- none"}

Write ${count} new questions.`;

  try {
    const client = new Anthropic();
    const response = await client.beta.messages.parse({
      model: TUTOR_MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "high", format: betaZodOutputFormat(Draft) },
      system: SYSTEM,
      messages: [{ role: "user", content: user }],
    });
    if (response.stop_reason === "refusal") return { created: 0, error: "The AI declined this request." };
    const out = response.parsed_output;
    if (!out) return { created: 0, error: "The AI response couldn't be read. Try again." };
    const seen = new Set(existing.map(e => e.prompt.trim().toLowerCase()));
    let created = 0;
    for (const q of out.questions.slice(0, count)) {
      const choices = [q.correct, ...q.wrong.slice(0, 3)].map(c => c.trim());
      if (choices.length !== 4 || new Set(choices).size !== 4 || choices.some(c => !c)) continue;
      if (!q.prompt.trim() || seen.has(q.prompt.trim().toLowerCase())) continue;
      seen.add(q.prompt.trim().toLowerCase());
      await db.question.create({
        data: {
          key: `draft-${crypto.randomUUID()}`, subject, grade,
          strand: q.strand.slice(0, 80), skill: q.skill.slice(0, 80), prompt: q.prompt.slice(0, 600),
          correct: choices[0], wrong1: choices[1], wrong2: choices[2], wrong3: choices[3],
          explanation: q.explanation.slice(0, 1000), active: false, reviewed: false, source: "ai-draft",
        },
      });
      created++;
    }
    return { created };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return { created: 0, error: "The ANTHROPIC_API_KEY on the server is invalid." };
    if (error instanceof Anthropic.RateLimitError) return { created: 0, error: "The AI service is busy. Try again in a minute." };
    if (error instanceof Anthropic.APIError) return { created: 0, error: `The AI service returned an error (${error.status}).` };
    console.error("drafting failed", error);
    return { created: 0, error: "Drafting failed. Try again." };
  }
}
