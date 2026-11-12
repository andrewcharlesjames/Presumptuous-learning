import { Info } from "@/components/Info";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSchoolUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { SUBJECT_BY_ID, gradeName, isSubjectId } from "@/lib/subjects";
import { lessonContent, MASTERY_PASS, MASTERY_SET, MAX_VARIANT } from "@/lib/lessons";
import { tutorConfigured } from "@/lib/tutor";
import { LessonLoader, LessonView } from "./LessonView";
import { startMasteryCheck } from "./actions";
import { startPractice } from "../practice/actions";

export const metadata = { title: "Learn" };

export default async function LearnPage({ searchParams }: { searchParams: Promise<{ subject?: string; grade?: string; skill?: string }> }) {
  const { user } = await requireSchoolUser(["STUDENT"]);
  const sp = await searchParams;
  const subject = sp.subject ?? "";
  const grade = Math.max(0, Math.min(13, Number(sp.grade) || 0));
  const skill = (sp.skill ?? "").slice(0, 120);
  if (!isSubjectId(subject) || !skill) redirect("/student");
  const subjectName = SUBJECT_BY_ID[subject].name(user.grade ?? grade);
  const progress = await db.skillProgress.findUnique({ where: { studentId_subject_grade_skill: { studentId: user.id, subject, grade, skill } } });
  const mastered = progress?.state === "MASTERED";
  const variant = Math.min(MAX_VARIANT, (progress?.attempts ?? 0) + 1);
  const lesson = mastered ? null : await db.lesson.findUnique({ where: { subject_grade_skill_variant: { subject, grade, skill, variant } } });
  const needsHelp = !mastered && (progress?.attempts ?? 0) >= MAX_VARIANT;

  return (
    <Shell user={user}>
      <div>
        <Link href="/student" className="small">← Today</Link>
        <span className="eyebrow" style={{ display: "block", marginTop: 10 }}>{subjectName} · {gradeName(grade)} skill</span>
        <h1 style={{ fontSize: "clamp(1.6rem,4vw,2.3rem)" }}>{skill}<Info label="Lessons">{"Read the lesson and try the examples, then take the 5-question mastery check. Get 4 right and you've mastered it. If not, you'll get the lesson again, explained a different way. After 3 tries your coach is told so they can help."}</Info></h1>
      </div>

      <ol className="row small muted" style={{ listStyle: "none", padding: 0, margin: 0, gap: 18 }} aria-label="Steps">
        <li><b style={{ color: "var(--ink)" }}>1. Learn</b></li><li>→</li>
        <li><b style={{ color: mastered ? "var(--ink)" : undefined }}>2. Check ({MASTERY_PASS} of {MASTERY_SET} to master it)</b></li><li>→</li>
        <li><b style={{ color: mastered ? "var(--above)" : undefined }}>3. Mastered</b></li>
      </ol>

      {mastered ? (
        <div className="card">
          <h2>You&apos;ve mastered this skill.</h2>
          <p className="muted">You scored {progress!.lastScore} of {progress!.lastTotal} on your check. It&apos;s off your plan now. Practice now and then to keep it sharp.</p>
          <div className="row">
            <Link className="btn primary" href="/student">Back to Today</Link>
            <form action={startPractice}><input type="hidden" name="subject" value={subject} /><input type="hidden" name="skill" value={skill} /><input type="hidden" name="grade" value={grade} /><button className="btn">Practice anyway</button></form>
          </div>
        </div>
      ) : (
        <>
          {progress && progress.attempts > 0 && (
            <div className={`flash ${needsHelp ? "error" : "ok"}`}>
              <span>Last check: {progress.lastScore} of {progress.lastTotal}. {needsHelp ? "Your coach can see you're working hard on this one and will help you with it." : "This lesson explains it a new way. Take your time."}</span>
            </div>
          )}
          {lesson && lesson.active ? (
            <>
              <LessonView content={lessonContent(lesson)} readAloud={(user.grade ?? grade) <= 2} />
              <form action={startMasteryCheck} className="card tight" style={{ maxWidth: 760 }}>
                <input type="hidden" name="subject" value={subject} /><input type="hidden" name="grade" value={grade} />
                <input type="hidden" name="skill" value={skill} /><input type="hidden" name="lessonId" value={lesson.id} />
                <div className="spread" style={{ alignItems: "center" }}>
                  <span>Ready? Answer {MASTERY_SET} questions. Get {MASTERY_PASS} right and you&apos;ve mastered it.</span>
                  <button className="btn primary">Start the check</button>
                </div>
              </form>
            </>
          ) : tutorConfigured() ? (
            <LessonLoader subject={subject} grade={grade} skill={skill} variant={variant} />
          ) : (
            <div className="card">
              <h2>Lessons aren&apos;t switched on yet</h2>
              <p className="muted">The platform needs to be connected to its AI service before it can write lessons. You can still practice this skill, or ask your coach to teach it.</p>
              <form action={startPractice}><input type="hidden" name="subject" value={subject} /><input type="hidden" name="skill" value={skill} /><input type="hidden" name="grade" value={grade} /><button className="btn primary">Practice this skill</button></form>
            </div>
          )}
        </>
      )}
    </Shell>
  );
}
