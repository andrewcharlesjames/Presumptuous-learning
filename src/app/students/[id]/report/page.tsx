import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canManageStudent, canViewStudent } from "@/lib/access";
import { auditView } from "@/lib/audit";
import { db } from "@/lib/db";
import { Logo } from "@/components/Logo";
import { FlashClear } from "@/components/FlashClear";
import { readFlash } from "@/lib/flash";
import { TermTabs } from "@/components/TermTabs";
import { PrintButton } from "@/app/invoices/[id]/PrintButton";
import { gradeName } from "@/lib/subjects";
import { fmtDate } from "@/lib/dates";
import { RATINGS, SKILLS, TERMS, currentTerm, isTerm, type SkillRatings, type Term } from "@/lib/report-rules";
import { reportFacts, yearOf, type Snapshot } from "@/lib/reports";

export const metadata = { title: "Report card" };
const long = { month: "long", day: "numeric", year: "numeric" } as const;

export default async function ReportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ term?: string }> }) {
  const { id } = await params;
  const viewer = await requireUser(["STUDENT", "PARENT", "COACH", "SCHOOL_ADMIN"]);
  if (!(await canViewStudent(viewer, id))) notFound();
  const staff = await canManageStudent(viewer, id);
  const student = await db.user.findUnique({ where: { id }, include: { school: true, studentIn: { include: { class: { include: { coaches: { include: { coach: true } } } } } } } });
  if (!student?.school) notFound();
  const school = student.school;
  const schoolYear = yearOf(school);
  const tq = Number((await searchParams).term);
  const released = await db.reportCard.findMany({ where: { studentId: id, schoolYear, status: "FINAL" }, select: { term: true } });
  const fallback = (staff ? currentTerm(new Date()) : (released.map(r => r.term).sort().at(-1) ?? 0)) as Term;
  const term: Term = isTerm(tq) ? tq : fallback;
  const report = await db.reportCard.findUnique({ where: { studentId_schoolYear_term: { studentId: id, schoolYear, term } } });
  const visible = report && (staff || report.status === "FINAL");
  await auditView(viewer, id, "student.view");
  const back = viewer.role === "PARENT" ? "/parent" : viewer.role === "STUDENT" ? `/students/${id}` : `/students/${id}`;
  const coaches = [...new Set(student.studentIn.flatMap(c => c.class.coaches.map(k => `${k.coach.firstName} ${k.coach.lastName}`)))];
  const flash = await readFlash();
  const head = (<>
    <div className="row noprint" style={{ justifyContent: "space-between", padding: "24px 0 16px" }}>
      <div className="row"><Link className="btn" href={back}>Back</Link><TermTabs base={`/students/${id}/report`} term={term} /></div>
      <div className="row">{staff && <Link className="btn" href={`/students/${id}/report/edit?term=${term}`}>Edit</Link>}{visible && <PrintButton />}</div>
    </div>
    {flash && <div className={`flash ${flash.tone} noprint`} role="status" style={{ marginBottom: 16 }}><FlashClear /><span>{flash.text}</span></div>}
  </>);
  if (!visible) return (
    <div className="wrap">{head}
      <div className="empty"><b>No {TERMS[term].name.toLowerCase()} yet</b><span>{staff ? "Write it from Edit." : `${student.firstName}'s ${school.coachTitle.toLowerCase()} releases it here when it's ready, usually in ${TERMS[term].season}.`}</span></div>
    </div>
  );
  // Print from what was saved, so a released report never changes; fall back to live data for old drafts.
  const snap = report.snapshot as Snapshot | null;
  const live = snap ? null : await reportFacts(school, student, schoolYear, term);
  const subjects = snap?.subjects ?? live!.subjects;
  const attendance = snap?.attendance ?? { present: live!.evidence.present, late: live!.evidence.late, absent: Math.max(0, live!.evidence.schoolDays - live!.evidence.present - live!.evidence.late) };
  const assessedAt = snap ? (snap.assessedAt ? new Date(snap.assessedAt) : null) : live!.assessedAt;
  const ratings = report.learningSkills as SkillRatings;
  const comments = report.comments as Record<string, string>;
  return (
    <div className="wrap report">
      {head}
      {report.status !== "FINAL" && <p className="flash error noprint"><span>Draft: the family can&apos;t see this until it&apos;s released.</span></p>}
      <article className="card" style={{ gap: 20, padding: 32 }}>
        <div className="spread" style={{ alignItems: "flex-start" }}>
          <Logo />
          <div style={{ textAlign: "right" }}><h1 style={{ fontSize: "1.5rem" }}>{TERMS[term].name}</h1><div className="small muted">{schoolYear}–{schoolYear + 1} school year</div></div>
        </div>
        <div className="grid3">
          <div><span className="eyebrow">Student</span><p><b>{student.firstName} {student.lastName}</b><br />{gradeName(student.grade ?? 0)}</p></div>
          <div><span className="eyebrow">School</span><p><b>{school.name}</b><br />{student.studentIn.map(c => c.class.name).join(", ")}</p></div>
          <div><span className="eyebrow">{school.coachTitle}</span><p>{coaches.join(", ") || "—"}<br /><span className="small muted">Attendance: {attendance.present} present, {attendance.late} late, {attendance.absent} absent</span></p></div>
        </div>
        <section className="stack">
          <h2 style={{ fontSize: "1.15rem" }}>Learning skills and work habits</h2>
          <div className="tablewrap"><table>
            <tbody>{SKILLS.map(s => <tr key={s.key}><td>{s.name}</td><td style={{ textAlign: "right" }}><b>{ratings[s.key] ?? "—"}</b> <span className="small muted">{ratings[s.key] ? RATINGS[ratings[s.key]!] : ""}</span></td></tr>)}</tbody>
          </table></div>
          <p className="small muted">E Excellent · G Good · S Satisfactory · N Needs improvement</p>
        </section>
        <section className="stack">
          <h2 style={{ fontSize: "1.15rem" }}>Subjects</h2>
          <div className="tablewrap"><table>
            <thead><tr><th>Subject</th>{(student.grade ?? 0) > 0 && <th>{term === 0 ? "Progress" : "Mark"}</th>}<th>Strengths and next steps</th></tr></thead>
            <tbody>{subjects.map(s => (
              <tr key={s.sid}><td><b>{s.name}</b></td>{(student.grade ?? 0) > 0 && <td style={{ whiteSpace: "nowrap" }}><b>{s.mark}</b></td>}<td className="small">{comments[s.sid] ?? ""}</td></tr>
            ))}</tbody>
          </table></div>
          {term > 0 && (student.grade ?? 0) > 0 && <p className="small muted">{(student.grade ?? 0) <= 6 ? "A = level 4 (above the provincial standard) · B = level 3 (the provincial standard) · C = level 2 · D = level 1." : "80–100% = level 4 · 70–79% = level 3 (the provincial standard) · 60–69% = level 2 · 50–59% = level 1."}</p>}
        </section>
        {report.general && <section className="stack" style={{ gap: 6 }}><h2 style={{ fontSize: "1.15rem" }}>Comments</h2><p style={{ whiteSpace: "pre-wrap" }}>{report.general}</p></section>}
        {report.nextSteps && <section className="stack" style={{ gap: 6 }}><h2 style={{ fontSize: "1.15rem" }}>Next steps for home</h2><p style={{ whiteSpace: "pre-wrap" }}>{report.nextSteps}</p></section>}
        <div className="grid3 small" style={{ paddingTop: 24 }}>
          <div className="sign">{school.coachTitle}</div><div className="sign">Principal</div><div className="sign">Parent or guardian</div>
        </div>
        <p className="small muted">{report.finalizedAt ? `Released ${fmtDate(report.finalizedAt, long)}. ` : ""}Marks reflect {student.firstName}&apos;s latest placement assessment{assessedAt ? ` (${fmtDate(assessedAt, long)})` : ""} on Presumptuous Learning.</p>
      </article>
    </div>
  );
}
