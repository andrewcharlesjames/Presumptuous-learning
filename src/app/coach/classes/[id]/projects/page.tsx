import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSchoolUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { projectSummary } from "@/components/ProjectRoadmap";
import { fmtDate, schoolYearOf, todayIn } from "@/lib/dates";
import { PROJECT_LABEL } from "@/lib/projects";
import { reviewMilestone } from "@/app/projects/actions";

export const metadata = { title: "Class projects" };

export default async function ClassProjects({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, school } = await requireSchoolUser(["COACH", "SCHOOL_ADMIN"]);
  const cls = await db.class.findFirst({
    where: { id, schoolId: school.id, ...(user.role === "COACH" ? { coaches: { some: { coachId: user.id } } } : {}) },
    include: { students: { include: { student: { select: { id: true, firstName: true, lastName: true, active: true } } }, orderBy: { student: { lastName: "asc" } } } },
  });
  if (!cls) notFound();
  const today = todayIn(school.timezone);
  const year = schoolYearOf(today);
  const students = cls.students.map(s => s.student).filter(s => s.active);
  const projects = await db.project.findMany({ where: { studentId: { in: students.map(s => s.id) }, schoolYear: year }, include: { milestones: { orderBy: { position: "asc" } } } });
  const queue = projects.flatMap(p => p.milestones.filter(m => m.status === "SUBMITTED").map(m => ({ p, m }))).sort((a, b) => +a.m.submittedAt! - +b.m.submittedAt!);
  const returnTo = `/coach/classes/${cls.id}/projects`;
  const cell = (sid: string, type: "LIFE_SKILLS" | "PURPOSE") => {
    const p = projects.find(x => x.studentId === sid && x.type === type);
    if (!p) return <span className="small muted">Not started</span>;
    const s = projectSummary(p);
    const late = s.next && s.next.dueDate < today && s.next.status !== "SUBMITTED";
    return (
      <span className="small"><b>{p.title || "Choosing an idea"}</b><br />
        {s.approved}/{s.total} approved{s.next && <> · next: {s.next.title} ({fmtDate(s.next.dueDate, { month: "short", day: "numeric" })})</>}
        {late && <> <span className="pill below">Overdue</span></>}{s.waiting > 0 && <> <span className="pill at">To review</span></>}
      </span>
    );
  };
  return (
    <Shell user={user}>
      <div><Link href={`/coach/classes/${cls.id}`} className="small">← {cls.name}</Link><h1>Class projects</h1>
        <p className="muted small" style={{ marginTop: 6 }}>{queue.length} step{queue.length === 1 ? "" : "s"} waiting for your review</p></div>
      <section className="stack">
        <h2>Waiting for review</h2>
        {queue.length ? queue.map(({ p, m }) => {
          const s = students.find(x => x.id === p.studentId)!;
          return (
            <div key={m.id} className="card">
              <div className="spread"><div><span className="eyebrow">{PROJECT_LABEL[p.type]} · {s.firstName} {s.lastName}</span><h3>{m.title}: {p.title}</h3></div>
                <Link className="small" href={`/students/${s.id}/projects`}>Whole project</Link></div>
              {m.key === "proposal" ? (
                <div className="stack" style={{ gap: 4 }}>
                  <p className="small"><b>In one sentence:</b> {p.oneLiner}</p>
                  <p className="small"><b>Problem:</b> {p.problem}</p>
                  <p className="small"><b>{p.type === "LIFE_SKILLS" ? "Customers" : "Who it helps"}:</b> {p.audience}</p>
                  <p className="small" style={{ whiteSpace: "pre-wrap" }}><b>Plan:</b> {p.plan}</p>
                </div>
              ) : <p className="small" style={{ whiteSpace: "pre-wrap" }}>{m.evidence}</p>}
              {m.link && <p className="small"><a href={m.link} target="_blank" rel="noopener noreferrer nofollow">{m.link}</a></p>}
              <form action={reviewMilestone} className="stack" style={{ gap: 8 }}>
                <input type="hidden" name="milestoneId" value={m.id} /><input type="hidden" name="returnTo" value={returnTo} />
                <label className="field small">Feedback<span className="hint">Required if you send it back</span><input id={`rv-${m.id}`} name="feedback" type="text" maxLength={1000} /></label>
                <div className="row" style={{ gap: 6 }}><button className="btn small primary" name="decision" value="APPROVED">Approve</button><button className="btn small" name="decision" value="NEEDS_WORK">Needs work</button></div>
              </form>
            </div>
          );
        }) : <p className="muted small">Nothing to review right now.</p>}
      </section>
      <section className="stack">
        <h2>Every student</h2>
        <div className="tablewrap"><table>
          <thead><tr><th>Student</th><th>Life Skills Project</th><th>Purpose Project</th></tr></thead>
          <tbody>{students.map(s => (
            <tr key={s.id}><td><Link href={`/students/${s.id}/projects`}>{s.firstName} {s.lastName}</Link></td><td>{cell(s.id, "LIFE_SKILLS")}</td><td>{cell(s.id, "PURPOSE")}</td></tr>
          ))}</tbody>
        </table></div>
      </section>
    </Shell>
  );
}
