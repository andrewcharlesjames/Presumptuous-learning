import Link from "next/link";
import { auditView } from "@/lib/audit";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canManageStudent, canViewStudent } from "@/lib/access";
import { db } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { ProjectRoadmap } from "@/components/ProjectRoadmap";
import { todayIn } from "@/lib/dates";
import { PROJECT_LABEL } from "@/lib/projects";

export const metadata = { title: "Projects" };

/** A student's projects as staff and family see them. Staff can approve or send back steps here. */
export default async function StudentProjects({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireUser();
  if (!(await canViewStudent(viewer, id))) notFound();
  if (viewer.id === id) redirect("/student/projects");
  const student = await db.user.findUnique({ where: { id }, include: { school: true } });
  if (!student?.school) notFound();
  const staff = await canManageStudent(viewer, id);
  await auditView(viewer, id, "student.projects");
  const projects = await db.project.findMany({ where: { studentId: id }, include: { milestones: { orderBy: { position: "asc" } } }, orderBy: [{ schoolYear: "desc" }, { type: "asc" }] });
  const today = todayIn(student.school.timezone);
  return (
    <Shell user={viewer}>
      <div><Link href={`/students/${id}`} className="small">← {student.firstName}&apos;s plan</Link><h1>{student.firstName}&apos;s projects</h1></div>
      {projects.length ? projects.map(p => (
        <section key={p.id} className="stack">
          <div><span className="eyebrow">{PROJECT_LABEL[p.type]} · {p.schoolYear}–{String(p.schoolYear + 1).slice(2)}</span>
            <h2>{p.title || "Choosing an idea"}</h2>{p.oneLiner && <p className="muted">{p.oneLiner}</p>}</div>
          {(p.problem || p.audience || p.plan) && (
            <div className="card tight">
              {p.problem && <p className="small"><b>Problem:</b> {p.problem}</p>}
              {p.audience && <p className="small"><b>{p.type === "LIFE_SKILLS" ? "Customers" : "Who it helps"}:</b> {p.audience}</p>}
              {p.plan && <p className="small" style={{ whiteSpace: "pre-wrap" }}><b>Plan:</b> {p.plan}</p>}
            </div>
          )}
          <ProjectRoadmap project={p} milestones={p.milestones} mode={staff ? "staff" : "family"} today={today} returnTo={`/students/${id}/projects`} />
        </section>
      )) : <div className="empty"><b>No projects started yet</b><span>{student.firstName} starts the Life Skills and Purpose projects from their Projects page.</span></div>}
    </Shell>
  );
}
