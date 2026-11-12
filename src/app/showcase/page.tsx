import { requireSchoolUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { projectSummary } from "@/components/ProjectRoadmap";
import { fmtLong, schoolYearOf, todayIn } from "@/lib/dates";
import { defaultLaunchDay, PROJECT_LABEL, type ProjectTypeName } from "@/lib/projects";
import { gradeName } from "@/lib/subjects";

export const metadata = { title: "Launch Day showcase" };

/** Every approved project in the school, for the school community. Shows first name and last initial only. */
export default async function Showcase() {
  const { user, school } = await requireSchoolUser(["STUDENT", "PARENT", "COACH", "SCHOOL_ADMIN"]);
  const today = todayIn(school.timezone);
  const year = schoolYearOf(today);
  const launch = school.launchDay ?? defaultLaunchDay(year);
  const days = Math.round((launch.getTime() - today.getTime()) / 86400000);
  const projects = await db.project.findMany({
    where: { schoolId: school.id, schoolYear: year, milestones: { some: { key: "proposal", status: "APPROVED" } } },
    include: { milestones: true, student: { select: { firstName: true, lastName: true, grade: true } } },
    orderBy: { title: "asc" },
  });
  const types: ProjectTypeName[] = ["LIFE_SKILLS", "PURPOSE"];
  return (
    <Shell user={user}>
      <section className="hero" style={{ paddingBlock: "16px 8px" }}>
        <span className="eyebrow">{school.name}</span>
        <h1>Launch Day showcase</h1>
        <p className="lede">{fmtLong(launch)} · {days > 0 ? `${days} days to go` : days === 0 ? "Today is Launch Day." : "Launched!"} · {projects.length} student project{projects.length === 1 ? "" : "s"}</p>
      </section>
      {types.map(t => {
        const list = projects.filter(p => p.type === t);
        return (
          <section key={t} className="stack">
            <h2>{PROJECT_LABEL[t]}s <span className="muted num">({list.length})</span></h2>
            {list.length ? (
              <div className="grid3" style={{ alignItems: "start" }}>{list.map(p => {
                const s = projectSummary(p);
                return (
                  <article key={p.id} className="card">
                    <h3>{p.title}</h3>
                    <p>{p.oneLiner}</p>
                    <p className="small muted">{p.student.firstName} {p.student.lastName.slice(0, 1)}. · {gradeName(p.student.grade ?? 0)}</p>
                    <div className="progress"><i style={{ width: `${(s.approved / s.total) * 100}%` }} /></div>
                    <p className="small muted">{s.approved} of {s.total} steps done</p>
                  </article>
                );
              })}</div>
            ) : <p className="muted small">Projects appear here once their proposals are approved.</p>}
          </section>
        );
      })}
    </Shell>
  );
}
