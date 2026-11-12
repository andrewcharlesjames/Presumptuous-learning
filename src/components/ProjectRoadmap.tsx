import type { Project, ProjectMilestone } from "@prisma/client";
import { fmtDate } from "@/lib/dates";
import { reviewMilestone, submitMilestone } from "@/app/projects/actions";

const STATUS = {
  TODO: { label: "To do", tone: "" },
  SUBMITTED: { label: "Waiting for review", tone: "at" },
  NEEDS_WORK: { label: "Needs work", tone: "below" },
  APPROVED: { label: "Approved", tone: "above" },
} as const;

/** The September-to-June roadmap. Students hand in the current step; staff approve or send back. */
export function ProjectRoadmap({ project, milestones, mode, today, returnTo }: {
  project: Project; milestones: ProjectMilestone[]; mode: "student" | "staff" | "family"; today: Date; returnTo: string;
}) {
  const current = milestones.find(m => m.status !== "APPROVED");
  const approved = milestones.filter(m => m.status === "APPROVED").length;
  return (
    <section className="card">
      <div className="spread"><h2>Roadmap</h2><span className="small muted num">{approved} of {milestones.length} steps approved</span></div>
      <div className="progress" role="progressbar" aria-label="Project steps approved" aria-valuemin={0} aria-valuemax={milestones.length} aria-valuenow={approved}><i style={{ width: `${(approved / milestones.length) * 100}%` }} /></div>
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 0 }}>
        {milestones.map(m => {
          const st = STATUS[m.status];
          const overdue = m.status !== "APPROVED" && m.dueDate < today;
          const isCurrent = current?.id === m.id;
          const canSubmit = mode === "student" && isCurrent && (m.status === "TODO" || m.status === "NEEDS_WORK") && m.key !== "discovery" && m.key !== "proposal";
          return (
            <li key={m.id} className={`blockrow ${isCurrent ? "now" : ""}`}>
              <div className="t"><b>{fmtDate(m.dueDate, { month: "short", day: "numeric" })}</b>{overdue ? <span className="pill below">Overdue</span> : `Step ${m.position + 1}`}</div>
              <div className="stack" style={{ gap: 6 }}>
                <div className="row" style={{ gap: 8 }}><h3 style={{ fontSize: "1rem" }}>{m.title}</h3><span className={`pill ${st.tone || "none"}`}>{st.label}</span></div>
                <p className="small muted">{m.description}</p>
                {m.evidence && <p className="small" style={{ whiteSpace: "pre-wrap" }}><b>{mode === "student" ? "What I did:" : "What they did:"}</b> {m.evidence}</p>}
                {m.link && <p className="small"><a href={m.link} target="_blank" rel="noopener noreferrer nofollow">{m.link}</a></p>}
                {m.feedback && <p className="small" style={{ padding: "8px 10px", background: m.status === "NEEDS_WORK" ? "var(--below-soft)" : "var(--accent-soft)", borderRadius: 8 }}><b>Coach:</b> {m.feedback}</p>}
                {canSubmit && (
                  <form action={submitMilestone} className="stack" style={{ gap: 8 }}>
                    <input type="hidden" name="id" value={project.id} /><input type="hidden" name="milestoneId" value={m.id} />
                    <label className="field small">What you did<span className="hint">Describe it so your coach can see the work: numbers, names of places, what you learned.</span>
                      <textarea id={`ev-${m.id}`} name="evidence" required defaultValue={m.status === "NEEDS_WORK" ? m.evidence : ""} style={{ fontFamily: "inherit", fontSize: ".95rem", minHeight: 90 }} /></label>
                    <label className="field small">Link<span className="hint">Optional: a video, document or your portfolio piece</span><input id={`ln-${m.id}`} name="link" type="text" defaultValue={m.link} placeholder="https://…" /></label>
                    <div><button className="btn small primary">{m.status === "NEEDS_WORK" ? "Hand it in again" : "Hand it in"}</button></div>
                  </form>
                )}
                {mode === "staff" && m.status === "SUBMITTED" && (
                  <form action={reviewMilestone} className="stack" style={{ gap: 8 }}>
                    <input type="hidden" name="milestoneId" value={m.id} /><input type="hidden" name="returnTo" value={returnTo} />
                    <label className="field small">Feedback<span className="hint">Required if you send it back</span><input id={`fbk-${m.id}`} name="feedback" type="text" maxLength={1000} /></label>
                    <div className="row" style={{ gap: 6 }}>
                      <button className="btn small primary" name="decision" value="APPROVED">Approve</button>
                      <button className="btn small" name="decision" value="NEEDS_WORK">Needs work</button>
                    </div>
                  </form>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** One-line summary for cards: title, steps approved, and what's next. */
export function projectSummary(p: Project & { milestones: ProjectMilestone[] }) {
  const approved = p.milestones.filter(m => m.status === "APPROVED").length;
  const next = p.milestones.find(m => m.status !== "APPROVED");
  return { approved, total: p.milestones.length, next, waiting: p.milestones.filter(m => m.status === "SUBMITTED").length };
}
