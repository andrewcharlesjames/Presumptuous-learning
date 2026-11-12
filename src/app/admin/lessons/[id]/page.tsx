import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { SUBJECT_BY_ID, gradeName, isSubjectId } from "@/lib/subjects";
import { lessonContent } from "@/lib/lessons";
import { LessonView } from "@/app/student/learn/LessonView";
import { setLessonFlag } from "../actions";

export default async function LessonDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(["PLATFORM_ADMIN"]);
  const l = await db.lesson.findUnique({ where: { id } });
  if (!l) notFound();
  const c = lessonContent(l);
  const flag = (field: string, value: boolean, label: string, primary = false) => (
    <form action={setLessonFlag}><input type="hidden" name="id" value={l.id} /><input type="hidden" name="field" value={field} /><input type="hidden" name="value" value={String(value)} /><button className={`btn small ${primary ? "primary" : ""}`}>{label}</button></form>
  );
  return (
    <Shell user={user}>
      <div className="spread">
        <div><Link href="/admin/lessons" className="small">← Lessons</Link>
          <span className="eyebrow" style={{ display: "block", marginTop: 10 }}>{isSubjectId(l.subject) ? SUBJECT_BY_ID[l.subject].name(l.grade) : l.subject} · {gradeName(l.grade)} · {l.variant === 1 ? "First lesson" : `Reteach ${l.variant - 1}`}</span>
          <h1 style={{ fontSize: "clamp(1.6rem,4vw,2.3rem)" }}>{l.skill}</h1></div>
        <div className="row">
          {flag("reviewed", !l.reviewed, l.reviewed ? "Unmark reviewed" : "Mark reviewed", !l.reviewed)}
          {flag("active", !l.active, l.active ? "Retire and rewrite" : "Restore")}
        </div>
      </div>
      <LessonView content={c} readAloud={false} />
      <section className="card" style={{ maxWidth: 760 }}>
        <h2>Mastery check questions</h2>
        <ol style={{ margin: 0, paddingLeft: 22, display: "grid", gap: 10 }}>{c.checkQuestions.map((q, i) => (
          <li key={i}>{q.prompt}<br /><span className="small"><b>{q.correct}</b> · <span className="muted">{q.wrong.join(" · ")}</span></span><br /><span className="small muted">{q.explanation}</span></li>
        ))}</ol>
      </section>
    </Shell>
  );
}
