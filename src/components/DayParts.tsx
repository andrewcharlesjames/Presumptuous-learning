import type { DailyLog } from "@prisma/client";
import { EFFORT, MOODS, effortLabel, moodLabel } from "@/lib/prompts";
import type { DayStatus } from "@/lib/schoolday";
import { WEEKDAYS } from "@/lib/dates";
import { checkIn, markPromptDone, reflect } from "@/app/student/day/actions";

export function CheckIn({ log, mindful }: { log: DailyLog | null; mindful: string }) {
  if (log?.checkedInAt) {
    return (
      <div className="stack" style={{ gap: 6 }}>
        <p className="small"><span className="pill above">Checked in</span> Feeling <b>{moodLabel(log.mood)}</b>{log.goal && <> · Goal: <b>{log.goal}</b></>}</p>
        <p className="small muted">Mindful minute: {mindful}</p>
      </div>
    );
  }
  return (
    <form action={checkIn} className="stack" style={{ gap: 10, marginTop: 6 }}>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="small" style={{ fontWeight: 600, marginBottom: 6 }}>How are you feeling this morning?</legend>
        <div className="att" role="radiogroup">{MOODS.map(m => (
          <label key={m.v}><input type="radio" name="mood" value={m.v} required id={`mood-${m.v}`} /><span>{m.label}</span></label>
        ))}</div>
      </fieldset>
      <label className="field small">One goal for today<input id="goal" name="goal" type="text" maxLength={200} placeholder="e.g. Master equivalent fractions" /></label>
      <p className="small muted">Mindful minute: {mindful}</p>
      <div><button className="btn small primary">Check in</button></div>
    </form>
  );
}

export function Reflect({ log }: { log: DailyLog | null }) {
  if (log?.reflectedAt) {
    return (
      <div className="stack" style={{ gap: 4 }}>
        <p className="small"><span className="pill above">Reflected</span> Effort: <b>{effortLabel(log.effort)}</b></p>
        <p className="small"><b>I learned:</b> {log.learned}</p>
        {log.question && <p className="small"><b>My question:</b> {log.question}</p>}
      </div>
    );
  }
  return (
    <form action={reflect} className="stack" style={{ gap: 10, marginTop: 6 }}>
      <label className="field small">One thing I learned today<input id="learned" name="learned" type="text" maxLength={500} required /></label>
      <label className="field small">A question I still have <span className="hint">Optional</span><input id="question" name="question" type="text" maxLength={300} /></label>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="small" style={{ fontWeight: 600, marginBottom: 6 }}>How hard did I push today?</legend>
        <div className="att" role="radiogroup">{EFFORT.map(e => (
          <label key={e.v}><input type="radio" name="effort" value={e.v} id={`effort-${e.v}`} /><span>{e.label}</span></label>
        ))}</div>
      </fieldset>
      <div><button className="btn small primary">Save my reflection</button></div>
    </form>
  );
}

export function PromptTask({ kind, label, prompt, done, studioHref }: { kind: "arts" | "life"; label?: string; prompt: string; done: boolean; studioHref?: string }) {
  return (
    <div className="stack" style={{ gap: 6, marginTop: 4 }}>
      <p className="small">{label && <b>{label}: </b>}{prompt}</p>
      <div className="row" style={{ gap: 8 }}>
        {studioHref && <a className={`btn small ${done ? "" : "primary"}`} href={studioHref}>{done ? "Open the studio" : "Hand in your work"}</a>}
        {done ? <span className="small"><span className="pill above">Done</span></span> : (
          <form action={markPromptDone}><input type="hidden" name="kind" value={kind} /><button className="btn small">{studioHref ? "Done offline" : "Mark done"}</button></form>
        )}
      </div>
    </div>
  );
}

/** Mon–Fri strip: complete, partly done, not started, or no school. */
export function WeekStrip({ days, today, since }: { days: DayStatus[]; today: string; since?: string }) {
  return (
    <div className="grid4" style={{ gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 6 }} aria-label="This week">
      {days.slice(0, 5).map((d, i) => {
        const parts = [d.checkedIn, d.learning > 0, d.reflected].filter(Boolean).length;
        if (since && d.date < since) {
          return <div key={d.date} className="chip none" style={{ display: "grid", gap: 2, padding: "6px 8px", textAlign: "center" }}><span>{WEEKDAYS[i].slice(0, 3)}</span><span style={{ fontWeight: 600 }}>—</span></div>;
        }
        const tone = !d.schoolDay ? "none" : d.complete ? "above" : parts > 0 ? "at" : d.date < today ? "below" : "none";
        const label = !d.schoolDay ? "No school" : d.complete ? "Complete" : parts > 0 ? `${parts} of 3` : d.date < today ? "Missed" : d.date === today ? "Today" : "Ahead";
        return (
          <div key={d.date} className={`chip ${tone}`} style={{ display: "grid", gap: 2, padding: "6px 8px", textAlign: "center", outline: d.date === today ? "2px solid var(--accent)" : undefined }}>
            <span>{WEEKDAYS[i].slice(0, 3)}</span><span style={{ fontWeight: 600 }}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}
