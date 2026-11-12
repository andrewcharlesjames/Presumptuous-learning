import { Info } from "@/components/Info";
import Link from "next/link";
import { auditView } from "@/lib/audit";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canManageStudent, canViewStudent } from "@/lib/access";
import { db } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { ArtCard } from "@/components/ArtCard";
import { DISCIPLINES, isDiscipline } from "@/lib/studio";

export const metadata = { title: "Portfolio" };

export default async function Portfolio({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ d?: string }> }) {
  const { id } = await params;
  const { d } = await searchParams;
  const viewer = await requireUser();
  if (!(await canViewStudent(viewer, id))) notFound();
  const student = await db.user.findUnique({ where: { id }, include: { school: true } });
  if (!student?.school) notFound();
  const self = viewer.id === id;
  const staff = await canManageStudent(viewer, id);
  await auditView(viewer, id, "student.portfolio");
  const filter = d && isDiscipline(d) ? d : null;
  const [works, counts] = await Promise.all([
    db.artwork.findMany({
      where: { studentId: id, ...(filter ? { discipline: filter } : {}) },
      include: { file: { select: { id: true, mime: true } }, feedback: { include: { author: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "asc" } } },
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }], take: 60,
    }),
    db.artwork.groupBy({ by: ["discipline"], where: { studentId: id }, _count: true }),
  ]);
  const total = counts.reduce((a, c) => a + c._count, 0);
  const base = `/students/${id}/portfolio`;
  return (
    <Shell user={viewer}>
      <div className="spread">
        <div><Link href={`/students/${id}`} className="small">← {self ? "My plan" : `${student.firstName}'s plan`}</Link>
          <h1>{self ? "My portfolio" : `${student.firstName}'s portfolio`}<Info label="Portfolio">{"All of the student's studio work and project evidence in one place. Starred pieces are the ones chosen as their best. Family and coaches can see it."}</Info></h1>
          <p className="muted small" style={{ marginTop: 6 }}>{total} piece{total === 1 ? "" : "s"} · starred work shows first</p></div>
        {self && <Link className="btn primary" href="/student/studio">Hand in new work</Link>}
      </div>
      {total > 0 && (
        <div className="tabs" role="tablist" aria-label="Filter by kind of work">
          <Link className="tab" role="tab" aria-selected={!filter} href={base} style={{ textDecoration: "none" }}>All ({total})</Link>
          {counts.map(c => (
            <Link key={c.discipline} className="tab" role="tab" aria-selected={filter === c.discipline} href={`${base}?d=${c.discipline}`} style={{ textDecoration: "none" }}>{DISCIPLINES[c.discipline]} ({c._count})</Link>
          ))}
        </div>
      )}
      {works.length ? (
        <div className="grid3" style={{ alignItems: "start" }}>{works.map(a => (
          <ArtCard key={a.id} art={a} tz={student.school!.timezone} canFeature={self || staff} canDelete={self || staff} canGiveFeedback={staff} returnTo={filter ? `${base}?d=${filter}` : base} />
        ))}</div>
      ) : <div className="empty"><b>No work yet</b><span>{self ? "Hand in something from the Studio to start your portfolio." : "Work appears here as it's handed in."}</span></div>}
    </Shell>
  );
}
