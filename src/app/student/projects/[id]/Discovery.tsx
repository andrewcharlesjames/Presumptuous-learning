"use client";
import { Info } from "@/components/Info";
import { useActionState } from "react";
import { runDiscovery } from "@/app/projects/actions";

type Q = { key: string; q: string; hint: string };

/** The discovery interview. Submitting asks the AI for ideas, which takes 20–40 seconds. */
export function Discovery({ id, questions, answers, aiOn }: { id: string; questions: Q[]; answers: Record<string, string>; aiOn: boolean }) {
  const [state, action, pending] = useActionState(runDiscovery, undefined);
  return (
    <form action={action} className="card">
      <h2>Discovery<Info label="Discovery">{"Answer these questions about what you love and what bothers you. There are no wrong answers. They help find a project that fits you. Your answers save when you continue."}</Info></h2>
      <p className="muted">Answer honestly. There are no wrong answers. Don&apos;t include anyone&apos;s name or address.</p>
      <input type="hidden" name="id" value={id} />
      {questions.map((q, i) => (
        <label key={q.key} className="field">{i + 1}. {q.q}<span className="hint">{q.hint}</span>
          <textarea id={`q-${q.key}`} name={q.key} maxLength={500} defaultValue={answers[q.key] ?? ""} style={{ fontFamily: "inherit", fontSize: ".95rem", minHeight: 64 }} /></label>
      ))}
      {state?.error && <p className="flash error" role="alert">{state.error}</p>}
      {aiOn ? (
        <div className="row"><button className="btn primary" disabled={pending}>{pending ? "Finding ideas that fit you… (about 30 seconds)" : "Show me ideas"}</button></div>
      ) : <p className="small muted">Idea suggestions are off for you right now (they need the AI service and, at your school, a parent&apos;s permission). You can still write your own idea below.</p>}
    </form>
  );
}
