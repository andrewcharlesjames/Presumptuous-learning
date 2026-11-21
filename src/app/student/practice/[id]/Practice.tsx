"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { answerPractice, explainPractice, type Feedback } from "../actions";

type Item = { subject: string; strand: string; prompt: string; options: string[] };

export function Practice({ id, items, start, tutor }: { id: string; items: Item[]; start: number; subject: string; skill: string; grade: number; tutor: boolean }) {
  const router = useRouter();
  const [idx, setIdx] = useState(start);
  const [picked, setPicked] = useState<number | null>(null);
  const [fb, setFb] = useState<Feedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [tutorText, setTutorText] = useState<string | null>(null);
  const [tutorPending, startTutor] = useTransition();
  const askTutor = () => startTutor(async () => {
    const r = await explainPractice(id, idx);
    setTutorText(r.text ?? r.error ?? null);
  });
  const q = items[idx];

  const check = () => {
    if (picked === null) return;
    startTransition(async () => {
      const r = await answerPractice(id, idx, picked);
      if (!r) { setError("That didn't save. Refresh the page to continue."); return; }
      setFb(r);
    });
  };
  const next = () => {
    if (fb?.done) { router.refresh(); return; }
    setIdx(idx + 1); setPicked(null); setFb(null); setTutorText(null); window.scrollTo(0, 0);
  };

  return (
    <section className="quiz" style={{ margin: 0 }}>
      <div className="progress" role="progressbar" aria-label="Practice progress" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={idx}><i style={{ width: `${(idx / items.length) * 100}%` }} /></div>
      <div className="card" style={{ gap: 18, padding: 26 }}>
        <div className="row"><span className="eyebrow">Question {idx + 1} of {items.length}</span><span className="chip">{q.strand}</span></div>
        <p className="qtext" id="qtext">{q.prompt}</p>
        <div className="opts" role="group" aria-labelledby="qtext">
          {q.options.map((o, k) => (
            <button key={k} type="button" className="opt" aria-pressed={picked === k} disabled={!!fb} onClick={() => setPicked(k)}>
              <span className="k">{"ABCD"[k]}</span><span>{o}</span>
            </button>
          ))}
          <button type="button" className="opt unsure" aria-pressed={picked === -1} disabled={!!fb} onClick={() => setPicked(-1)}>
            <span className="k">?</span><span>I&apos;m not sure yet</span>
          </button>
        </div>
        {fb && (
          <Teach fb={fb} />
        )}
        {fb && !fb.ok && tutor && (
          tutorText
            ? <div className="card tight" style={{ background: "var(--accent-soft)", border: 0 }} role="status"><span className="eyebrow">Tutor</span><p>{tutorText}</p></div>
            : <div><button type="button" className="btn small" onClick={askTutor} disabled={tutorPending}>{tutorPending ? "Thinking…" : "Explain it to me"}</button></div>
        )}
        {error && <p className="flash error" role="alert">{error}</p>}
        <div className="spread" style={{ alignItems: "center" }}>
          <span className="small muted">Practice shows the answer right away. It doesn&apos;t change your placement.</span>
          {fb
            ? <button type="button" className="btn primary" onClick={next}>{fb.done ? "See my score" : "Next question"}</button>
            : <button type="button" className="btn primary" disabled={picked === null || pending} onClick={check}>{pending ? "Checking…" : "Check"}</button>}
        </div>
      </div>
    </section>
  );
}

/** Feedback that teaches either way: why the right answer is right, and why a wrong choice is wrong. */
export function Teach({ fb }: { fb: Pick<Feedback, "ok" | "correctText" | "chosenText" | "explanation" | "whyWrong"> }) {
  return (
    <div className={`flash ${fb.ok ? "ok" : "error"} teach`} role="status">
      {fb.ok ? (
        <>
          <span>Yes, that&apos;s right!</span>
          <span style={{ fontWeight: 400 }}>{fb.explanation ? <><b>Why:</b> {fb.explanation}</> : <>“{fb.correctText}” is the answer.</>}</span>
        </>
      ) : (
        <>
          <span>{fb.chosenText ? <>Not quite. You chose “{fb.chosenText}”.</> : <>That&apos;s OK. Here&apos;s how to think about it.</>}</span>
          {fb.chosenText && fb.whyWrong && <span style={{ fontWeight: 400 }}><b>Why that&apos;s not it:</b> {fb.whyWrong}</span>}
          <span style={{ fontWeight: 400 }}><b>The answer is “{fb.correctText}”.</b>{fb.explanation ? <> {fb.explanation}</> : null}</span>
        </>
      )}
    </div>
  );
}
