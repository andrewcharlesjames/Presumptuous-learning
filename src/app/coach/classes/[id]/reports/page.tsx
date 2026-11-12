import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSchoolUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { Info } from "@/components/Info";
import { TermTabs } from "@/components/TermTabs";
import { gradeName } from "@/lib/subjects";
import { fmtDate } from "@/lib/dates";
import { TERMS, currentTerm, isTerm, type Term } from "@/lib/report-rules";
import { yearOf } from "@/lib/reports";

export const metadata = { title: "Report cards" };

export default async function ClassReports({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ term?: string }> }) {
  const { id } = await params;
  const { user, school } = await requireSchoolUser(["COACH", "SCHOOL_ADMIN"]);
  const cls = await db.class.findFirst({
    where: { id, schoolId: school.id, ...(user.role === "COACH" ? { coaches: { some: { coachId: user.id } } } : {}) },
    include: { students: { include: { student: true }, orderBy: { student: { lastName: "asc" } } } },
  });
  if (!cls) notFound();
  const tq = Number((await searchParams).term);
  const term: Term = isTerm(tq) ? tq : currentTerm(new Date());
  const schoolYear = yearOf(school);
  const students = cls.students.map(s => s.student).filter(s => s.active);
  const reports = await db.reportCard.findMany({ where: { studentId: { in: students.map(s => s.id) }, schoolYear, term } });
  const by = new Map(reports.map(r => [r.studentId, r]));
  const released = reports.filter(r => r.status === "FINAL").length;
  return (
    <Shell user={user}>
      <div className="spread">
        <div><Link href={`/coach/classes/${cls.id}`} className="small">← {cls.name}</Link>
          <h1>Report cards<Info label="Report cards">{"Three reports a year, as in Ontario: the fall progress report (November), and Term 1 (February) and Term 2 (June) report cards. Open a student to write theirs: marks, comment drafts and learning-skill suggestions are filled in from their work on the platform for you to edit. Families see a report only after you release it."}</Info></h1></div>
        <span className="chip">{released} of {students.length} released</span>
      </div>
      <TermTabs base={`/coach/classes/${cls.id}/reports`} term={term} />
      <div className="tablewrap"><table>
        <thead><tr><th>Student</th><th>Grade</th><th>{TERMS[term].short}</th><th></th></tr></thead>
        <tbody>{students.map(s => {
          const r = by.get(s.id);
          return (
            <tr key={s.id}>
              <td><b>{s.firstName} {s.lastName}</b></td>
              <td className="small">{gradeName(s.grade ?? 0)}</td>
              <td><span className={`chip ${r?.status === "FINAL" ? "above" : r ? "at" : ""}`}>{r?.status === "FINAL" ? `Released ${r.finalizedAt ? fmtDate(r.finalizedAt) : ""}` : r ? "Draft" : "Not started"}</span></td>
              <td><div className="row">
                <Link className="btn small" href={`/students/${s.id}/report/edit?term=${term}`}>{r?.status === "FINAL" ? "Open" : r ? "Keep writing" : "Write"}</Link>
                {r && <Link className="btn small" href={`/students/${s.id}/report?term=${term}`}>View</Link>}
              </div></td>
            </tr>
          );
        })}</tbody>
      </table></div>
    </Shell>
  );
}
