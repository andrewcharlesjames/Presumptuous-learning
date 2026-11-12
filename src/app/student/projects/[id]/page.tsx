import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSchoolUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { ProjectRoadmap } from "@/components/ProjectRoadmap";
import { fmtLong, todayIn } from "@/lib/dates";
import { defaultLaunchDay, INTERVIEW, PROJECT_LABEL, type Idea } from "@/lib/projects";
import { tutorConfigured } from "@/lib/tutor";
import { chooseIdea, saveProposal } from "@/app/projects/actions";
import { Discovery } from "./Discovery";
import { aiAllowedFor } from "@/lib/consent";

export const metadata = { title: "Project" };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, school } = await requireSchoolUser(["STUDENT"]);
  const p = await db.project.findFirst({ where: { id, studentId: user.id }, include: { milestones: { orderBy: { position: "asc" } } } });
  if (!p) notFound();
  const today = todayIn(school.timezone);
  const launch = school.launchDay ?? defaultLaunchDay(p.schoolYear);
  const discovery = p.milestones.find(m => m.key === "discovery");
  const proposal = p.milestones.find(m => m.key === "proposal");
  const discovered = discovery?.status === "APPROVED";
  const ideas = (p.ideas ?? []) as Idea[];
  const answers = (p.interview ?? {}) as Record<string, string>;
  const life = p.type === "LIFE_SKILLS";
  const aiOn = tutorConfigured() && await aiAllowedFor(user.id, school);
  const proposalLocked = proposal?.status === "APPROVED" || proposal?.status === "SUBMITTED";

  return (
    <Shell user={user}>
      <div className="spread">
        <div><Link href="/student/projects" className="small">← My projects</Link>
          <span className="eyebrow" style={{ display: "block", marginTop: 10 }}>{PROJECT_LABEL[p.type]}</span>
          <h1>{p.title || (life ? "Find your business idea" : "Find your cause")}</h1>
          {p.oneLiner && <p className="muted" style={{ marginTop: 6 }}>{p.oneLiner}</p>}</div>
        <span className="small muted">Launch Day: {fmtLong(launch)}</span>
      </div>

      {!discovered && (
        ideas.length ? (
          <section className="stack">
            <h2>Ideas made for you</h2>
            <p className="muted">Pick the one that excites you most. You can change the details in your proposal.</p>
            <div className="grid2" style={{ alignItems: "start" }}>{ideas.map((idea, i) => (
              <form key={i} action={chooseIdea} className="card">
                <input type="hidden" name="id" value={p.id} /><input type="hidden" name="idea" value={i} />
                <h3>{idea.title}</h3>
                <p>{idea.oneLiner}</p>
                <p className="small muted">{idea.whyYou}</p>
                <ol className="small" style={{ margin: 0, paddingLeft: 18 }}>{idea.firstSteps.map((s, j) => <li key={j}>{s}</li>)}</ol>
                <div><button className="btn primary small">Choose this idea</button></div>
              </form>
            ))}</div>
            <details className="items"><summary>Answer the questions again for new ideas</summary>
              <div style={{ marginTop: 10 }}><Discovery id={p.id} questions={INTERVIEW} answers={answers} aiOn={aiOn} /></div>
            </details>
          </section>
        ) : <Discovery id={p.id} questions={INTERVIEW} answers={answers} aiOn={aiOn} />
      )}

      {!discovered && (
        <form action={chooseIdea} className="card tight">
          <input type="hidden" name="id" value={p.id} />
          <label className="field">Already have an idea?<span className="hint">Give it a working title and go straight to your proposal.</span>
            <input id="ownTitle" name="ownTitle" type="text" maxLength={120} required /></label>
          <div><button className="btn small">Use my own idea</button></div>
        </form>
      )}

      {discovered && (
        <form action={saveProposal} className="card" id="proposal">
          <div className="spread"><h2>Proposal</h2>
            {proposal && <span className={`pill ${proposal.status === "APPROVED" ? "above" : proposal.status === "SUBMITTED" ? "at" : proposal.status === "NEEDS_WORK" ? "below" : "none"}`}>
              {proposal.status === "APPROVED" ? "Approved" : proposal.status === "SUBMITTED" ? "Waiting for review" : proposal.status === "NEEDS_WORK" ? "Needs work" : "Not handed in"}</span>}</div>
          {proposal?.feedback && <p className="small" style={{ padding: "8px 10px", background: proposal.status === "NEEDS_WORK" ? "var(--below-soft)" : "var(--accent-soft)", borderRadius: 8 }}><b>Coach:</b> {proposal.feedback}</p>}
          <input type="hidden" name="id" value={p.id} />
          <label className="field">Title<input id="p-title" name="title" type="text" maxLength={120} defaultValue={p.title} required /></label>
          <label className="field">In one sentence<span className="hint">{life ? "What you sell and to whom" : "What you'll do and for whom"}</span><input id="p-one" name="oneLiner" type="text" maxLength={240} defaultValue={p.oneLiner} /></label>
          <label className="field">The problem<span className="hint">{life ? "What do your customers need or struggle with?" : "What's wrong, and why does it matter?"}</span><textarea id="p-problem" name="problem" maxLength={1000} defaultValue={p.problem} style={{ fontFamily: "inherit", fontSize: ".95rem", minHeight: 70 }} /></label>
          <label className="field">{life ? "Your customers" : "Who it helps"}<textarea id="p-audience" name="audience" maxLength={500} defaultValue={p.audience} style={{ fontFamily: "inherit", fontSize: ".95rem", minHeight: 60 }} /></label>
          <label className="field">Your plan<span className="hint">The main steps, and what or who you'll need</span><textarea id="p-plan" name="plan" maxLength={2000} defaultValue={p.plan} style={{ fontFamily: "inherit", fontSize: ".95rem", minHeight: 90 }} /></label>
          <div className="row">
            <button className="btn" name="submit" value="0">Save</button>
            {!proposalLocked && <button className="btn primary" name="submit" value="1">Hand in for approval</button>}
          </div>
        </form>
      )}

      {discovered && <ProjectRoadmap project={p} milestones={p.milestones} mode="student" today={today} returnTo={`/student/projects/${p.id}`} />}
    </Shell>
  );
}
