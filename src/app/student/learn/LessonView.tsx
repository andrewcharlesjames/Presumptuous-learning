"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { LessonContent } from "@/lib/lessons";
import { prepareLesson } from "./actions";

/** Shown while the lesson is written for the first time. */
export function LessonLoader({ subject, grade, skill, variant }: { subject: string; grade: number; skill: string; variant: number }) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    prepareLesson(subject, grade, skill, variant).then(r => {
      if (!live) return;
      if (r.ok) router.refresh(); else setFailed(true);
    }).catch(() => live && setFailed(true));
    return () => { live = false; };
  }, [subject, grade, skill, variant, router]);
  return (
    <div className="card" role="status" aria-live="polite" style={{ maxWidth: 760 }}>
      {failed ? (
        <>
          <h2>The lesson couldn&apos;t be written just now</h2>
          <p className="muted">Try again in a minute. If it keeps happening, tell your coach.</p>
          <div><button className="btn" onClick={() => location.reload()}>Try again</button></div>
        </>
      ) : (
        <>
          <h2>Writing your lesson…</h2>
          <p className="muted">{variant > 1 ? "This one explains it a different way." : "It's made for this exact skill and grade."} It usually takes 20 to 40 seconds, and then it&apos;s ready for everyone who needs it.</p>
          <div className="progress"><i style={{ width: "60%", animation: "none" }} /></div>
        </>
      )}
    </div>
  );
}

export function LessonView({ content: c, readAloud }: { content: LessonContent; readAloud: boolean }) {
  return (
    <article className="stack" style={{ maxWidth: 760 }}>
      {readAloud && <p className="flash ok"><span>Grown-up: please read this lesson aloud together.</span></p>}
      <section className="card">
        <span className="eyebrow">Why it matters</span>
        <p style={{ fontSize: "1.08rem" }}>{c.whyItMatters}</p>
        <h2>{c.title}</h2>
        {c.explanation.map((p, i) => <p key={i} style={{ fontSize: "1.02rem", lineHeight: 1.65 }}>{p}</p>)}
      </section>
      {c.examples.map((ex, i) => (
        <section key={i} className="card">
          <span className="eyebrow">Worked example {i + 1}</span>
          <p style={{ fontWeight: 600, fontSize: "1.05rem" }}>{ex.problem}</p>
          <ol style={{ margin: 0, paddingLeft: 22, display: "grid", gap: 6 }}>{ex.steps.map((s, j) => <li key={j}>{s}</li>)}</ol>
          <p><b>Answer:</b> {ex.answer}</p>
        </section>
      ))}
      <section className="card" style={{ background: "var(--below-soft)", border: 0 }}>
        <span className="eyebrow">Watch out</span>
        <p>{c.commonMistake}</p>
      </section>
      <TryIt q={c.tryIt} />
    </article>
  );
}

function TryIt({ q }: { q: LessonContent["tryIt"] }) {
  // Same order on the server and in the browser: derived from the question text.
  const order = useMemo(() => {
    let h = 0;
    for (const ch of q.prompt) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const o = [0, 1, 2, 3];
    for (let i = 3; i > 0; i--) { h = (h * 1103515245 + 12345) >>> 0; const j = h % (i + 1); [o[i], o[j]] = [o[j], o[i]]; }
    return o;
  }, [q.prompt]);
  const choices = [q.correct, ...q.wrong];
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <section className="card">
      <span className="eyebrow">Try it</span>
      <p className="qtext" style={{ fontSize: "1.15rem" }}>{q.prompt}</p>
      <div className="opts">
        {order.map((oi, k) => (
          <button key={k} type="button" className="opt" aria-pressed={picked === oi} disabled={picked !== null} onClick={() => setPicked(oi)}>
            <span className="k">{"ABCD"[k]}</span><span>{choices[oi]}</span>
          </button>
        ))}
      </div>
      {picked !== null && (
        <div className={`flash ${picked === 0 ? "ok" : "error"}`} role="status">
          <span>{picked === 0 ? "Yes, that's it." : `Not quite. The answer is ${q.correct}.`}</span>
          <span style={{ fontWeight: 400 }}>{q.explanation}</span>
          {picked !== 0 && <button type="button" className="linkbtn" style={{ justifySelf: "start" }} onClick={() => setPicked(null)}>Try it again</button>}
        </div>
      )}
    </section>
  );
}
