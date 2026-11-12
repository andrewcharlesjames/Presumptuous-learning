import Link from "next/link";
import { requireSchoolUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { projectSummary } from "@/components/ProjectRoadmap";
import { fmtDate, fmtLong, schoolYearOf, todayIn } from "@/lib/dates";
import { defaultLaunchDay, PROJECT_BLURB, PROJECT_LABEL, type ProjectTypeName } from "@/lib/projects";
import { startProject } from "@/app/projects/actions";

export const metadata = { title: "Projects" };

export default async function MyProjects() {
  const { user, school } = await requireSchoolUser(["STUDENT"]);
  const today = todayIn(school.timezone);
  const year = schoolYearOf(today);
  const launch = school.launchDay ?? defaultLaunchDay(year);
  const days = Math.round((launch.getTime() - today.getTime()) / 86400000);
  const projects = await db.project.findMany({ where: { studentId: user.id, schoolYear: year }, include: { milestones: { orderBy: { position: "asc" } } } });
  const types: ProjectTypeName[] = ["LIFE_SKILLS", "PURPOSE"];
  return (
    <Shell user={user}>
      <div className="spread">
        <div><span className="eyebrow">{year}–{String(year + 1).slice(2)} school year</span><h1>My projects</h1></div>
        <div style={{ textAlign: "right" }}>
          <b>Launch Day: {fmtLong(launch)}</b><br />
          <span className="small muted">{days > 0 ? `${days} days to go` : days === 0 ? "It's today!" : "Done for this year"} · <Link href="/showcase">See the showcase</Link></span>
        </div>
      </div>
      <div className="grid2" style={{ alignItems: "start" }}>
        {types.map(t => {
          const p = projects.find(x => x.type === t);
          const s = p ? projectSummary(p) : null;
          return (
            <section key={t} className="card">
              <span className="eyebrow">{PROJECT_LABEL[t]}</span>
              {p && s ? (
                <>
                  <h2>{p.title || "Choosing an idea"}</h2>
                  {p.oneLiner && <p className="muted">{p.oneLiner}</p>}
                  <div className="progress"><i style={{ width: `${(s.approved / s.total) * 100}%` }} /></div>
                  <p className="small">{s.approved} of {s.total} steps approved{s.next && <> · Next: <b>{s.next.title}</b>, due {fmtDate(s.next.dueDate, { month: "short", day: "numeric" })}</>}</p>
                  <div><Link className="btn primary" href={`/student/projects/${p.id}`}>Open project</Link></div>
                </>
              ) : (
                <>
                  <h2>{t === "LIFE_SKILLS" ? "Start a business" : "Make a difference"}</h2>
                  <p className="muted">{PROJECT_BLURB[t]} It starts with a few questions about you, then ideas made for you.</p>
                  <form action={startProject}><input type="hidden" name="type" value={t} /><button className="btn primary">Start my {PROJECT_LABEL[t]}</button></form>
                </>
              )}
            </section>
          );
        })}
      </div>
    </Shell>
  );
}
