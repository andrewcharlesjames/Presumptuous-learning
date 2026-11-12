import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { gradeName } from "./subjects";
import { INTERVIEW, type Idea, type ProjectTypeName } from "./projects";
import { TUTOR_MODEL, tutorConfigured } from "./tutor";

const Ideas = z.object({
  ideas: z.array(z.object({ title: z.string(), oneLiner: z.string(), whyYou: z.string(), firstSteps: z.array(z.string()) })),
});

const SYSTEM = `You help students in Ontario schools (Kindergarten to Grade 12) find a year-long project that fits them.
The student answered discovery questions about themselves. Suggest exactly 4 project ideas built from their answers.

Every idea must be:
- realistic for their age to run from September to a Launch Day in May, with school and family support;
- safe and legal for a minor in Ontario: no handling of money without a parent, no meeting strangers alone, no food sold without safe-handling guidance, nothing online that collects personal information;
- specific to what the student said (name the interest or skill it builds on in whyYou, speaking to the student as "you");
- written in plain language suited to the student's grade, with Canadian spelling. Always spell practice with a c.

For each idea: a short title, a one-sentence oneLiner, a one- or two-sentence whyYou, and 3 concrete firstSteps.
If an answer is empty, unclear or inappropriate, ignore it and work from the rest.`;

const KIND: Record<ProjectTypeName, string> = {
  LIFE_SKILLS: "Presumptuous Project (life skills and business): a small business or venture the student starts and runs (a product, a service, an event or a club that charges a small fee).",
  PURPOSE: "Purpose Project: a community-impact or give-back project that helps people, animals or the environment, with an impact that can be measured.",
};

/** AI-suggested project ideas. Only the answers and grade are sent; never the student's name. */
export async function suggestIdeas(type: ProjectTypeName, grade: number, answers: Record<string, string>): Promise<Idea[] | null> {
  if (!tutorConfigured()) return null;
  const qa = INTERVIEW.map(i => `Q: ${i.q}\nA: ${(answers[i.key] ?? "").slice(0, 500) || "(no answer)"}`).join("\n\n");
  try {
    const response = await new Anthropic().beta.messages.parse({
      model: TUTOR_MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(Ideas) },
      system: SYSTEM,
      messages: [{ role: "user", content: `Project type: ${KIND[type]}\nStudent's grade: ${gradeName(grade)}\n\n${qa}` }],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) return null;
    return response.parsed_output.ideas.slice(0, 4).map(i => ({ ...i, firstSteps: i.firstSteps.slice(0, 4) }));
  } catch (error) {
    if (error instanceof Anthropic.APIError) console.error(`project ideas: API error ${error.status}`);
    else console.error("project ideas failed", error);
    return null;
  }
}
