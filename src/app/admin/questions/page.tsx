import { Info } from "@/components/Info";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { ensureBankSeeded } from "@/lib/questions";
import { GENERATORS } from "@/lib/generators";
import { ASSESSED, SUBJECTS, SUBJECT_BY_ID, gradeName, gradeShort, isSubjectId } from "@/lib/subjects";
import { approveDraft, deleteDraft, draftWithAI, setQuestionFlag } from "./actions";
import { tutorConfigured } from "@/lib/tutor";

export const metadata = { title: "Question bank" };
const POOLS = Array.from({ length: 14 }, (_, g) => g);

export default async function QuestionBank({ searchParams }: { searchParams: Promise<{ subject?: string; grade?: string }> }) {
  const user = await requireUser(["PLATFORM_ADMIN"]);
  const sp = await searchParams;
  await ensureBankSeeded();
  const counts = await db.question.groupBy({ by: ["subject", "grade", "active", "reviewed"], _count: true });
  const cell = new Map<string, { active: number; reviewed: number }>();
  let total = 0, reviewedTotal = 0;
  for (const c of counts) {
    if (!c.active) continue;
    const k = `${c.subject}:${c.grade}`;
    const v = cell.get(k) ?? { active: 0, reviewed: 0 };
    v.active += c._count; if (c.reviewed) v.reviewed += c._count;
    cell.set(k, v);
    total += c._count; if (c.reviewed) reviewedTotal += c._count;
  }
  const gen = new Set(GENERATORS.map(g => g.grade));
  const subject = sp.subject && isSubjectId(sp.subject) ? sp.subject : null;
  const grade = sp.grade !== undefined && /^\d+$/.test(sp.grade) ? Number(sp.grade) : null;
  const list = subject && grade !== null
    ? await db.question.findMany({ where: { subject, grade }, orderBy: [{ source: "asc" }, { active: "desc" }, { strand: "asc" }, { createdAt: "asc" }] })
    : [];
  const drafts = await db.question.count({ where: { source: "ai-draft" } });
  const tone = (n: number) => n >= 10 ? "above" : n >= 6 ? "at" : "below";

  return (
    <Shell user={user}>
      <div className="spread">
        <div><span className="eyebrow">Platform</span><h1>Question bank</h1>
          <p className="muted small" style={{ marginTop: 6 }}>{total} active questions · {reviewedTotal} reviewed by a certified teacher · {GENERATORS.length} math question generators (Grades K–12) that make fresh questions every time.{drafts > 0 && ` ${drafts} AI drafts waiting for review.`}</p></div>
        <Link className="btn primary" href={`/admin/questions/new${subject ? `?subject=${subject}${grade !== null ? `&grade=${grade}` : ""}` : ""}`}>Add a question</Link>
      </div>

      <section className="stack">
        <h2>Coverage<Info label="Coverage">{"How many active questions each subject has at each grade. Thin cells make placement less accurate; add questions or use AI drafting there. Math also has generators that make fresh questions every time."}</Info></h2>
        <p className="muted small">Active questions per subject and grade. Aim for 10 or more in each cell so retakes and practice don&apos;t repeat. Red: fewer than 6. ✦ = math generators also cover this grade. Select a cell to see its questions.</p>
        <div className="tablewrap"><table>
          <thead><tr><th>Subject</th>{POOLS.map(g => <th key={g} className="num">{g === 13 ? "12+" : gradeShort(g)}</th>)}</tr></thead>
          <tbody>{ASSESSED.map(s => (
            <tr key={s.id}>
              <td className="small"><b>{s.name(5)}</b></td>
              {POOLS.map(g => {
                const v = cell.get(`${s.id}:${g}`);
                const relevant = (v?.active ?? 0) > 0 || g >= s.min;
                if (!relevant) return <td key={g} />;
                const n = v?.active ?? 0;
                return (
                  <td key={g} className="num">
                    <Link href={`/admin/questions?subject=${s.id}&grade=${g}`} className={`chip ${tone(n)}`} style={{ textDecoration: "none", outline: subject === s.id && grade === g ? "2px solid var(--accent)" : undefined }}>
                      {n}{s.id === "math" && gen.has(g) ? "✦" : ""}
                    </Link>
                  </td>
                );
              })}
            </tr>
          ))}</tbody>
        </table></div>
      </section>

      {subject && grade !== null && (
        <section className="stack">
          <div className="spread"><h2>{SUBJECT_BY_ID[subject].name(grade)} · {gradeName(grade)}</h2>
            <div className="row">
              {tutorConfigured() && (
                <form action={draftWithAI}><input type="hidden" name="subject" value={subject} /><input type="hidden" name="grade" value={grade} />
                  <button className="btn small">Draft 5 questions with AI</button></form>
              )}
              <Link className="btn small" href={`/admin/questions/new?subject=${subject}&grade=${grade}`}>Add to this grade</Link>
            </div></div>
          {!tutorConfigured() && <p className="small muted">Add ANTHROPIC_API_KEY on the server to draft questions with AI.</p>}
          {list.length ? (
            <div className="tablewrap"><table>
              <thead><tr><th>Question</th><th>Answer</th><th>Skill</th><th>Status</th><th></th></tr></thead>
              <tbody>{list.map(q => (
                <tr key={q.id} style={q.active ? undefined : { opacity: .5 }}>
                  <td style={{ maxWidth: 420 }}>{q.prompt}{!q.explanation && <span className="small muted"> · no explanation yet</span>}</td>
                  <td className="small"><b>{q.correct}</b><br /><span className="muted">{q.wrong1} · {q.wrong2} · {q.wrong3}</span></td>
                  <td className="small">{q.skill}<br /><span className="muted">{q.strand}</span></td>
                  <td className="small">{q.source === "ai-draft" ? <span className="pill at">AI draft</span> : q.active ? "Active" : "Retired"}<br />{q.reviewed ? <span className="pill above">Reviewed</span> : <span className="muted">Not reviewed</span>}</td>
                  <td><div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                    <Link className="btn small" href={`/admin/questions/${q.id}`}>Edit</Link>
                    {q.source === "ai-draft" && <>
                      <form action={approveDraft}><input type="hidden" name="id" value={q.id} /><button className="btn small primary">Approve</button></form>
                      <form action={deleteDraft}><input type="hidden" name="id" value={q.id} /><button className="btn small danger">Discard</button></form>
                    </>}
                    <form action={setQuestionFlag}><input type="hidden" name="id" value={q.id} /><input type="hidden" name="field" value="reviewed" /><input type="hidden" name="value" value={String(!q.reviewed)} /><button className="btn small">{q.reviewed ? "Unmark" : "Mark reviewed"}</button></form>
                    {q.source !== "ai-draft" && <form action={setQuestionFlag}><input type="hidden" name="id" value={q.id} /><input type="hidden" name="field" value="active" /><input type="hidden" name="value" value={String(!q.active)} /><button className="btn small">{q.active ? "Retire" : "Restore"}</button></form>}
                  </div></td>
                </tr>
              ))}</tbody>
            </table></div>
          ) : <div className="empty">No questions here yet.</div>}
        </section>
      )}
    </Shell>
  );
}
