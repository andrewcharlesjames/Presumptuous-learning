import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { SUBJECT_BY_ID, gradeName, isSubjectId } from "@/lib/subjects";
import { fmtDate } from "@/lib/dates";
import { tutorConfigured } from "@/lib/tutor";

export const metadata = { title: "Lessons" };

export default async function LessonsAdmin({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const user = await requireUser(["PLATFORM_ADMIN"]);
  const { show } = await searchParams;
  const where = show === "unreviewed" ? { reviewed: false, active: true } : {};
  const [lessons, total, reviewed, mastered, learning] = await Promise.all([
    db.lesson.findMany({ where, orderBy: [{ subject: "asc" }, { grade: "asc" }, { skill: "asc" }, { variant: "asc" }], take: 300 }),
    db.lesson.count({ where: { active: true } }),
    db.lesson.count({ where: { active: true, reviewed: true } }),
    db.skillProgress.count({ where: { state: "MASTERED" } }),
    db.skillProgress.count({ where: { state: "LEARNING" } }),
  ]);
  return (
    <Shell user={user}>
      <div className="spread">
        <div><span className="eyebrow">Platform</span><h1>Lessons</h1>
          <p className="muted small" style={{ marginTop: 6, maxWidth: "70ch" }}>
            Lessons are written by AI the first time any student needs a skill, then shared with every student who needs it. Variant 1 teaches the skill; variants 2 and 3 reteach it differently after a missed check. {total} active lessons · {reviewed} reviewed · {mastered} skills mastered by students so far · {learning} in progress.
            {!tutorConfigured() && " Lessons can't be written until ANTHROPIC_API_KEY is set on the server."}
          </p></div>
        <div className="tabs" role="tablist">
          <Link className="tab" role="tab" aria-selected={show !== "unreviewed"} href="/admin/lessons" style={{ textDecoration: "none" }}>All</Link>
          <Link className="tab" role="tab" aria-selected={show === "unreviewed"} href="/admin/lessons?show=unreviewed" style={{ textDecoration: "none" }}>Needs review</Link>
        </div>
      </div>
      {lessons.length ? (
        <div className="tablewrap"><table>
          <thead><tr><th>Skill</th><th>Subject</th><th>Grade</th><th>Version</th><th>Status</th><th>Written</th></tr></thead>
          <tbody>{lessons.map(l => (
            <tr key={l.id} style={l.active ? undefined : { opacity: .5 }}>
              <td><Link href={`/admin/lessons/${l.id}`}>{l.skill}</Link></td>
              <td className="small">{isSubjectId(l.subject) ? SUBJECT_BY_ID[l.subject].name(l.grade) : l.subject}</td>
              <td className="small">{gradeName(l.grade)}</td>
              <td className="small">{l.variant === 1 ? "First lesson" : `Reteach ${l.variant - 1}`}</td>
              <td>{!l.active ? <span className="muted small">Retired</span> : l.reviewed ? <span className="pill above">Reviewed</span> : <span className="pill at">Not reviewed</span>}</td>
              <td className="small muted">{fmtDate(l.createdAt, { month: "short", day: "numeric", year: "numeric" })}</td>
            </tr>
          ))}</tbody>
        </table></div>
      ) : <div className="empty"><b>No lessons yet</b><span>They appear here as students start learning skills from their plans.</span></div>}
    </Shell>
  );
}
