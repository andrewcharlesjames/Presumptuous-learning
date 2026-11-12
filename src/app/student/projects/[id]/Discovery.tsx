"use client";
import { useActionState } from "react";
import { runDiscovery } from "@/app/projects/actions";

type Q = { key: string; q: string; hint: string };

/** The discovery interview. Submitting asks the AI for ideas, which takes 20–40 seconds. */
export function Discovery({ id, questions, answers, aiOn }: { id: string; questions: Q[]; answers: Record<string, string>; aiOn: boolean }) {
  const [state, action, pending] = useActionState(runDiscovery, undefined);
  return (
    <form action={action} className="card">
      <h2>Discovery</h2>
      <p className="muted">Answer honestly. There are no wrong answers. Don&apos;t include anyone&apos;s name or address.</p>
      <input type="hidden" name="id" value={id} />
      {questions.map((q, i) => (
        <label key={q.key} className="field">{i + 1}. {q.q}<span className="hint">{q.hint}</span>
          <textarea id={`q-${q.key}`} name={q.key} maxLength={500} defaultValue={answers[q.key] ?? ""} style={{ fontFamily: "inherit", fontSize: ".95rem", minHeight: 64 }} /></label>
      ))}
      {state?.error && <p className="flash error" role="alert">{state.error}</p>}
      {aiOn ? (
        <div className="row"><button className="btn primary" disabled={pending}>{pending ? "Finding ideas that fit you… (about 30 seconds)" : "Show me ideas"}</button></div>
      ) : <p className="small muted">Idea suggestions need the platform&apos;s AI service. You can still write your own idea below.</p>}
    </form>
  );
}
