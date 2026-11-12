"use client";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitAnswer, type NextView } from "../actions";

type View = NonNullable<NextView>;

export function Quiz({ id, studentId, initial, readAloud }: { id: string; studentId: string; initial: View; readAloud: boolean }) {
  const router = useRouter();
  const [view, setView] = useState<View>(initial);
  const [picked, setPicked] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const q = view.question;

  const next = useCallback(() => {
    if (picked === null || pending) return;
    setError(null);
    startTransition(async () => {
      const r = await submitAnswer(id, view.index, picked);
      if (!r.ok) { setError("That answer didn't save. Refresh the page to continue where you left off."); return; }
      if (r.done) { router.push(`/students/${studentId}?done=1`); return; }
      if (r.next) { setView(r.next); setPicked(null); window.scrollTo(0, 0); }
    });
  }, [id, picked, pending, router, studentId, view.index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      if (["a", "b", "c", "d"].includes(k)) setPicked("abcd".indexOf(k));
      else if (k === "?") setPicked(-1);
      else if (k === "enter") { e.preventDefault(); next(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next]);

  const pct = ((view.subjectNumber - 1) / view.subjectCount) * 100;
  return (
    <section className="quiz">
      <div className="stack" style={{ gap: 8 }}>
        <div className="spread small muted num"><span>Subject {view.subjectNumber} of {view.subjectCount}</span><span>Question {view.inSubject} in this subject</span></div>
        <div className="progress" role="progressbar" aria-label="Assessment progress" aria-valuemin={0} aria-valuemax={view.subjectCount} aria-valuenow={view.subjectNumber - 1}><i style={{ width: `${pct}%` }} /></div>
      </div>
      <div className="card" style={{ gap: 18, padding: 26 }}>
        <div className="row"><h2 style={{ fontSize: "1.1rem" }}>{q.subject}</h2><span className="chip">{q.strand}</span></div>
        <p className="qtext" id="qtext" data-n={view.index}>{q.prompt}</p>
        <div className="opts" role="group" aria-labelledby="qtext">
          {q.options.map((o, k) => (
            <button key={k} type="button" className="opt" aria-pressed={picked === k} onClick={() => setPicked(k)}>
              <span className="k">{"ABCD"[k]}</span><span>{o}</span>
            </button>
          ))}
          <button type="button" className="opt unsure" aria-pressed={picked === -1} onClick={() => setPicked(-1)}>
            <span className="k">?</span><span>I&apos;m not sure yet</span>
          </button>
        </div>
        {error && <p className="flash error" role="alert">{error}</p>}
        <div className="spread" style={{ alignItems: "center" }}>
          <span className="small muted">{readAloud ? "Grown-up: read the question and choices aloud." : "Keys: A–D to choose, Enter for next"}</span>
          <button type="button" className="btn primary" disabled={picked === null || pending} onClick={next}>{pending ? "Saving…" : "Next"}</button>
        </div>
      </div>
      <p className="small muted" style={{ textAlign: "center", maxWidth: "60ch", margin: "0 auto" }}>
        Questions get harder when you&apos;re right and easier when you&apos;re not sure, so the assessment finds the level that fits you. Answers save as you go.
      </p>
    </section>
  );
}
