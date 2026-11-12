"use client";
import { useCallback, useEffect, useState, useTransition } from "react";
import { finishAssessment, saveAnswer } from "../actions";

type Q = { subject: string; strand: string; prompt: string; options: string[] };

export function Quiz({ id, questions, initial, start, readAloud }: { id: string; questions: Q[]; initial: (number | null)[]; start: number; readAloud: boolean }) {
  const [idx, setIdx] = useState(start);
  const [picked, setPicked] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const q = questions[idx];
  const n = questions.length;
  const answered = picked.filter(p => p !== null).length;
  const subjects = [...new Set(questions.map(x => x.subject))];

  const choose = useCallback((choice: number) => {
    setPicked(p => { const c = p.slice(); c[idx] = choice; return c; });
    setError(null);
    startTransition(async () => {
      const r = await saveAnswer(id, idx, choice);
      if (!r.ok) setError("Your answer didn't save. Check your connection and choose again.");
    });
  }, [id, idx]);

  const next = useCallback(() => {
    if (picked[idx] === null) return;
    if (idx < n - 1) { setIdx(idx + 1); window.scrollTo(0, 0); }
    else startTransition(() => finishAssessment(id));
  }, [id, idx, n, picked]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      if (["a", "b", "c", "d"].includes(k)) choose("abcd".indexOf(k));
      else if (k === "?") choose(-1);
      else if (k === "enter") { e.preventDefault(); next(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choose, next]);

  return (
    <section className="quiz">
      <div className="stack" style={{ gap: 8 }}>
        <div className="spread small muted num"><span>Question {idx + 1} of {n}</span><span>Subject {subjects.indexOf(q.subject) + 1} of {subjects.length} · {answered} answered</span></div>
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={n} aria-valuenow={answered}><i style={{ width: `${(answered / n) * 100}%` }} /></div>
      </div>
      <div className="card" style={{ gap: 18, padding: 26 }}>
        <div className="row"><h2 style={{ fontSize: "1.1rem" }}>{q.subject}</h2><span className="chip">{q.strand}</span></div>
        <p className="qtext" id="qtext">{q.prompt}</p>
        <div className="opts" role="group" aria-labelledby="qtext">
          {q.options.map((o, k) => (
            <button key={k} type="button" className="opt" aria-pressed={picked[idx] === k} onClick={() => choose(k)}>
              <span className="k">{"ABCD"[k]}</span><span>{o}</span>
            </button>
          ))}
          <button type="button" className="opt unsure" aria-pressed={picked[idx] === -1} onClick={() => choose(-1)}>
            <span className="k">?</span><span>I&apos;m not sure yet</span>
          </button>
        </div>
        {error && <p className="flash error" role="alert">{error}</p>}
        <div className="spread" style={{ alignItems: "center" }}>
          <button type="button" className="btn" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>Back</button>
          <span className="small muted">{readAloud ? "Grown-up: read the question and choices aloud." : "Keys: A–D to choose, Enter for next"}</span>
          <button type="button" className="btn primary" disabled={picked[idx] === null || pending} onClick={next}>
            {idx === n - 1 ? (pending ? "Finishing…" : "See my results") : "Next"}
          </button>
        </div>
      </div>
      <p className="small muted" style={{ textAlign: "center" }}>Your answers save as you go. You can stop and come back later.</p>
    </section>
  );
}
