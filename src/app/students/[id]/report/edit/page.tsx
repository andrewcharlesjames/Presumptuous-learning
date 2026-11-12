import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSchoolUser } from "@/lib/auth";
import { canManageStudent } from "@/lib/access";
import { db } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { Info } from "@/components/Info";
import { TermTabs } from "@/components/TermTabs";
import { gradeName } from "@/lib/subjects";
import { fmtDate } from "@/lib/dates";
import { RATINGS, SKILLS, TERMS, currentTerm, isTerm, type SkillRatings, type Term } from "@/lib/report-rules";
import { reportFacts, yearOf } from "@/lib/reports";
import { saveReport } from "@/app/reports/actions";

export const metadata = { title: "Write a report" };

export default async function EditReport({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ term?: string }> }) {
  const { id } = await params;
  const { user, school } = await requireSchoolUser(["COACH", "SCHOOL_ADMIN"]);
  if (!(await canManageStudent(user, id))) notFound();
  const student = await db.user.findUnique({ where: { id } });
  if (!student) notFound();
  const schoolYear = yearOf(school);
  const tq = Number((await searchParams).term);
  const term: Term = isTerm(tq) ? tq : currentTerm(new Date());
  const [report, facts] = await Promise.all([
    db.reportCard.findUnique({ where: { studentId_schoolYear_term: { studentId: id, schoolYear, term } } }),
    reportFacts(school, student, schoolYear, term),
  ]);
  const saved = (report?.learningSkills ?? {}) as SkillRatings;
  const comments = (report?.comments ?? {}) as Record<string, string>;
  const final = report?.status === "FINAL";
  const ev = facts.evidence;
  const kg = (student.grade ?? 0) === 0;
  return (
    <Shell user={user}>
      <div className="spread">
        <div><Link href={`/students/${id}`} className="small">← {student.firstName} {student.lastName}</Link>
          <h1>{TERMS[term].name}<Info label="Writing a report">{"Marks come from the student's latest placement assessment. Comments start as drafts written from what the student mastered and what's next: edit them in your own words. Learning skills are suggested from attendance, finished days, practice, assignments, project steps and reflections; Collaboration is left for you. Save as a draft as often as you like. Release to family when it's done: the student and parents can then see and print it."}</Info></h1>
          <p className="muted small">{gradeName(student.grade ?? 0)} · {schoolYear}–{String(schoolYear + 1).slice(2)} · reporting on {fmtDate(facts.from, { month: "short", day: "numeric" })} to {fmtDate(facts.to, { month: "short", day: "numeric", year: "numeric" })}</p></div>
        <div className="row">
          <span className={`chip ${final ? "above" : report ? "at" : ""}`}>{final ? "Released" : report ? "Draft" : "Not started"}</span>
          <Link className="btn" href={`/students/${id}/report?term=${term}`}>Preview</Link>
        </div>
      </div>
      <TermTabs base={`/students/${id}/report/edit`} term={term} />
      {final ? (
        <form action={saveReport} className="card">
          <input type="hidden" name="studentId" value={id} /><input type="hidden" name="term" value={term} /><input type="hidden" name="intent" value="reopen" />
          <p>This report was released to {student.firstName}&apos;s family{report?.finalizedAt ? ` on ${fmtDate(report.finalizedAt, { month: "long", day: "numeric" })}` : ""}. To change it, reopen it; the family won&apos;t see it until you release it again.</p>
          <div><button className="btn">Reopen to edit</button></div>
        </form>
      ) : (
        <form action={saveReport} className="stack-lg">
          <input type="hidden" name="studentId" value={id} /><input type="hidden" name="term" value={term} />
          <section className="card">
            <h2>Learning skills<Info label="Learning skills">{"Ontario's six learning skills and work habits, rated E (Excellent), G (Good), S (Satisfactory) or N (Needs improvement). The suggestion comes from what the platform saw this term; you decide."}</Info></h2>
            <p className="small muted">This term: {ev.schoolDays} school days so far · present {ev.present}, late {ev.late} · {ev.completeDays} full days · {ev.reflections} reflections · {ev.practiceSets} practice sets · {ev.assignmentsDone} of {ev.assignmentsDue} assignments done · {ev.projectStepsApproved} of {ev.projectStepsDue} project steps approved · {ev.masteredSkills} skills mastered.</p>
            <div className="grid3">
              {SKILLS.map(s => (
                <label key={s.key} className="field" htmlFor={`skill_${s.key}`}>
                  <span>{s.name}<span className="hint" style={{ display: "block" }}>{s.hint}{facts.suggested[s.key] && !saved[s.key] ? ` · suggested ${facts.suggested[s.key]}` : ""}</span></span>
                  <select id={`skill_${s.key}`} name={`skill_${s.key}`} defaultValue={saved[s.key] ?? facts.suggested[s.key] ?? ""}>
                    <option value="">Choose…</option>
                    {Object.entries(RATINGS).map(([k, v]) => <option key={k} value={k}>{k} · {v}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </section>
          <section className="card">
            <h2>Subjects<Info label="Marks and comments">{kg ? "Kindergarten reports have comments only, no marks." : term === 0 ? "The fall progress report uses Progressing very well, well, or with difficulty, from the placement assessment." : (student.grade ?? 0) <= 6 ? "Grades 1 to 6 get letter grades: A = level 4, B = level 3, C = level 2, D = level 1, from the latest placement assessment." : "Grades 7 to 12 get percentage ranges: 80–100% = level 4, 70–79% = level 3, 60–69% = level 2, 50–59% = level 1, from the latest placement assessment."}</Info></h2>
            {facts.subjects.length === 0 && <p className="muted">{student.firstName} hasn&apos;t finished a placement assessment, so there are no marks yet. You can still write comments below once they have.</p>}
            {facts.subjects.map(s => (
              <label key={s.sid} className="field" htmlFor={`comment_${s.sid}`}>
                <span className="spread"><span>{s.name}</span><span className="small">{s.mark && <b>{s.mark}</b>} <span className="muted">· level {s.level} · working at {s.working} level</span></span></span>
                <textarea id={`comment_${s.sid}`} name={`comment_${s.sid}`} rows={3} defaultValue={comments[s.sid] ?? s.draft} maxLength={2000} />
              </label>
            ))}
          </section>
          <section className="card">
            <h2>Overall</h2>
            <label className="field" htmlFor="general">Comment on the term<textarea id="general" name="general" rows={4} defaultValue={report?.general ?? ""} maxLength={3000} placeholder={`How ${student.firstName} has grown, their projects, and what you're proud of.`} /></label>
            <label className="field" htmlFor="nextSteps">Next steps for home<textarea id="nextSteps" name="nextSteps" rows={3} defaultValue={report?.nextSteps ?? ""} maxLength={2000} placeholder="One or two things the family can do to help." /></label>
          </section>
          <div className="row">
            <button className="btn" name="intent" value="draft">Save draft</button>
            <button className="btn primary" name="intent" value="final">Release to family</button>
          </div>
        </form>
      )}
    </Shell>
  );
}
