"use client";
import { useState } from "react";

/** Serializable plan shape passed from the server. */
export type PlanData = {
  todayLabel: string;
  weekend: boolean;
  blocks: { min: number; title: string; mode: string; modeLabel: string; before: string; skill: string; after: string }[];
  schedule: { day: string; items: { name: string; status: string }[] }[];
  perDay: number;
  weeks: { label: string; title: string; detail: string; lines: { name: string; sessions: number; picks: { skill: string; mode: string; modeLabel: string }[] }[] }[];
  finalMonth: string;
  traj: { name: string; steps: { when: string; st: string; note?: string }[] }[];
  months: { label: string; ph: number; phaseName: string; goal: string; items: string[]; milestones: string[] }[];
  nextGrade: string;
};

const ST = { below: "Below", at: "At", above: "Above" } as Record<string, string>;

export function PlanView({ plan }: { plan: PlanData }) {
  const [tab, setTab] = useState<"today" | "month" | "year">("today");
  const total = plan.blocks.reduce((a, b) => a + b.min, 0);
  let clock = 0;
  return (
    <section className="stack">
      <div className="spread">
        <div><span className="eyebrow">The plan</span><h2>Built to finish above grade level</h2></div>
        <div className="tabs" role="tablist">
          {(["today", "month", "year"] as const).map(t => (
            <button key={t} type="button" role="tab" className="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
              {t === "today" ? "Today" : t === "month" ? "This month" : "This year"}
            </button>
          ))}
        </div>
      </div>
      <div className="card" role="tabpanel">
        {tab === "today" && <>
          <p className="flash ok" style={{ fontWeight: 500 }}><span>{plan.weekend ? "Weekend" : "Today"}, {plan.todayLabel}: <b>{total} minutes</b> of focused learning.</span></p>
          <div className="day">{plan.blocks.map((b, i) => { const s = clock; clock += b.min; return (
            <div key={i} className="blockrow">
              <div className="t"><b>{b.min} min</b>{s}–{clock}</div>
              <div><h3 style={{ fontSize: "1rem" }}>{b.title} <span className={`mode ${b.mode}`}>{b.modeLabel}</span></h3>
                <p className="small muted">{b.before}{b.skill && <b>{b.skill}</b>}{b.after}</p></div>
            </div>
          ); })}</div>
        </>}
        {tab === "month" && <>
          <p className="muted small">Weekly rhythm: subjects below grade level get 4 sessions a week, at grade level 3, above grade level 2.</p>
          <div className="tablewrap"><table>
            <thead><tr><th>Session</th>{plan.schedule.map(d => <th key={d.day}>{d.day}</th>)}</tr></thead>
            <tbody>{Array.from({ length: plan.perDay }, (_, i) => (
              <tr key={i}><td className="muted">{i + 1}</td>{plan.schedule.map(d => <td key={d.day}>{d.items[i] && <span className={`pill ${d.items[i].status}`} style={{ whiteSpace: "normal" }}>{d.items[i].name}</span>}</td>)}</tr>
            ))}</tbody>
          </table></div>
          {plan.weeks.map((w, k) => (
            <div key={k} className="stack" style={{ gap: 6, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
              <span className="eyebrow">Week {k + 1} · from {w.label}</span>
              <h3>{w.title}</h3><p className="muted small">{w.detail}</p>
              {k < 3 ? (
                <ul style={{ margin: 0, paddingLeft: 18 }} className="small">{w.lines.map(l => (
                  <li key={l.name}><b>{l.name}</b> ({l.sessions}×/week): {l.picks.map((p, j) => <span key={j}>{j > 0 && " · "}{p.skill} <span className={`mode ${p.mode}`}>{p.modeLabel}</span></span>)}</li>
                ))}</ul>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18 }} className="small">
                  <li>Monday to Wednesday: mixed review of every skill from weeks 1–3.</li>
                  <li>Thursday: redo the two hardest skills.</li>
                  <li>Friday: retake the assessment. Subjects that move up get harder work; any that slip go back to repair.</li>
                </ul>
              )}
            </div>
          ))}
        </>}
        {tab === "year" && <>
          <p className="flash ok" style={{ fontWeight: 500 }}><span>Target: <b>above grade level in every subject by {plan.finalMonth}</b>, then a summer bridge into {plan.nextGrade}.</span></p>
          <div className="tablewrap"><table>
            <thead><tr><th>Subject</th><th>Path to above grade level</th></tr></thead>
            <tbody>{plan.traj.map(t => (
              <tr key={t.name}><td><b>{t.name}</b></td><td><span className="row" style={{ gap: 6 }}>{t.steps.map((s, i) => (
                <span key={i} className="row" style={{ gap: 6 }}>{i > 0 && <span className="muted">→</span>}<span className={`pill ${s.st}`}>{s.when}: {ST[s.st]}{s.note ? ` · ${s.note}` : ""}</span></span>
              ))}</span></td></tr>
            ))}</tbody>
          </table></div>
          <div className="grid2">{plan.months.map(m => (
            <div key={m.label} className="card tight" style={{ background: "var(--paper)" }}>
              <span className="eyebrow">{m.ph < 5 ? `Phase ${m.ph} · ` : ""}{m.phaseName}</span>
              <h3>{m.label}</h3>
              <p className="small muted">{m.goal}</p>
              <ul style={{ margin: 0, paddingLeft: 18 }} className="small">{m.items.map((x, i) => <li key={i}>{x}</li>)}</ul>
              {m.milestones.map((x, i) => <span key={i} className="small" style={{ padding: "5px 9px", border: "1px dashed var(--line)", borderRadius: 7 }}>{x}</span>)}
            </div>
          ))}</div>
        </>}
      </div>
    </section>
  );
}
