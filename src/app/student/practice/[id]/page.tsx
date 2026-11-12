import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { publicQuestion, type Answer, type StoredQuestion } from "@/lib/assessment";
import { lookupFor } from "@/lib/questions";
import { SUBJECT_BY_ID, gradeName, isSubjectId } from "@/lib/subjects";
import { Practice } from "./Practice";
import { startPractice } from "../actions";
import { tutorConfigured } from "@/lib/tutor";
import { MASTERY_PASS, MASTERY_SET } from "@/lib/lessons";
import { learnHref } from "@/lib/links";

export const metadata = { title: "Practice" };

export default async function PracticePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(["STUDENT"]);
  const s = await db.practiceSession.findFirst({ where: { id, studentId: user.id } });
  if (!s || !isSubjectId(s.subject)) notFound();
  const questions = s.questions as StoredQuestion[];
  const answers = s.answers as Answer[];
  const lookup = await lookupFor(questions);
  const grade = user.grade ?? 0;
  const items = questions.map(q => publicQuestion(q, lookup(q)!, grade));
  const title = `${SUBJECT_BY_ID[s.subject].name(grade)}${s.skill ? ` · ${s.skill}` : ""}`;
  const start = answers.findIndex(a => a === null);
  const progress = s.kind === "mastery"
    ? await db.skillProgress.findUnique({ where: { studentId_subject_grade_skill: { studentId: user.id, subject: s.subject, grade: s.grade, skill: s.skill } } })
    : null;

  return (
    <Shell user={user}>
      <div className="spread">
        <div><Link href="/student" className="small">← Today</Link><h1 style={{ fontSize: "clamp(1.5rem,3.5vw,2.1rem)" }}>{s.kind === "mastery" ? "Mastery check" : "Practice"}: {title}</h1>
          <p className="muted small" style={{ marginTop: 6 }}>{gradeName(s.grade)} questions · {questions.length} in this set</p></div>
      </div>
      {start < 0 && s.kind === "mastery" ? (
        <div className="card" style={{ maxWidth: 720 }}>
          {progress?.state === "MASTERED" ? (
            <>
              <h2>Mastered: {s.correct} of {s.total}</h2>
              <p className="muted">You learned it and proved it. This skill comes off your plan, and the next one moves up.</p>
              <div className="row"><Link className="btn primary" href="/student">Next skill</Link></div>
            </>
          ) : (
            <>
              <h2>Not yet: {s.correct} of {s.total}</h2>
              <p className="muted">You need {MASTERY_PASS} of {MASTERY_SET}. That&apos;s okay: overreaching means some misses. Next, you&apos;ll get a new lesson that explains it a different way, then a fresh check.</p>
              <div className="row"><Link className="btn primary" href={learnHref(s.subject, s.grade, s.skill)}>Learn it another way</Link><Link className="btn" href="/student">Back to Today</Link></div>
            </>
          )}
        </div>
      ) : start < 0 ? (
        <div className="card" style={{ maxWidth: 720 }}>
          <h2>Set complete: {s.correct} of {s.total}</h2>
          <p className="muted">{s.correct === s.total ? "Every one right. Time to stretch further." : s.correct >= s.total * 0.6 ? "Solid work. One more set will lock it in." : "Good effort. Mistakes show what to practise next. Try another set."}</p>
          <div className="row">
            <form action={startPractice}>
              <input type="hidden" name="subject" value={s.subject} /><input type="hidden" name="skill" value={s.skill} />
              <input type="hidden" name="grade" value={s.correct === s.total ? Math.min(13, s.grade + 1) : s.grade} />
              <button className="btn primary">{s.correct === s.total ? `Try ${gradeName(Math.min(13, s.grade + 1))} questions` : "Another set"}</button>
            </form>
            <Link className="btn" href="/student">Back to Today</Link>
          </div>
        </div>
      ) : <Practice id={s.id} items={items} start={start} subject={s.subject} skill={s.skill} grade={s.grade} tutor={!!user.school?.aiTutor && tutorConfigured()} />}
    </Shell>
  );
}
