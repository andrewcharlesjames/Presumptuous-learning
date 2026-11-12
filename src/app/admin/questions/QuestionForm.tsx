import type { Question } from "@prisma/client";
import { ASSESSED, SUBJECTS, gradeName } from "@/lib/subjects";
import { saveQuestion } from "./actions";

export function QuestionForm({ q, subject, grade }: { q?: Question; subject?: string; grade?: number }) {
  return (
    <form action={saveQuestion} className="card">
      {q && <input type="hidden" name="id" value={q.id} />}
      <div className="form-grid">
        <label className="field">Subject<select id="subject" name="subject" defaultValue={q?.subject ?? subject ?? "math"}>{ASSESSED.map(s => <option key={s.id} value={s.id}>{s.name(5)}{s.min >= 9 ? " (secondary)" : ""}</option>)}</select></label>
        <label className="field">Grade<select id="grade" name="grade" defaultValue={q?.grade ?? grade ?? 5}>{Array.from({ length: 14 }, (_, g) => <option key={g} value={g}>{gradeName(g)}</option>)}</select></label>
        <label className="field">Strand<input id="strand" name="strand" type="text" defaultValue={q?.strand} placeholder="e.g. Number" required /></label>
        <label className="field">Skill<span className="hint">Short and specific. Plans and practice use it.</span><input id="skill" name="skill" type="text" defaultValue={q?.skill} placeholder="e.g. Equivalent fractions" required /></label>
      </div>
      <label className="field">Question<textarea id="prompt" name="prompt" defaultValue={q?.prompt} required style={{ fontFamily: "inherit", fontSize: ".95rem", minHeight: 80 }} /></label>
      <div className="grid2">
        <label className="field">Correct answer<input id="correct" name="correct" type="text" defaultValue={q?.correct} required /></label>
        <label className="field">Wrong answer 1<span className="hint">Use common mistakes as wrong answers.</span><input id="wrong1" name="wrong1" type="text" defaultValue={q?.wrong1} required /></label>
        <label className="field">Wrong answer 2<input id="wrong2" name="wrong2" type="text" defaultValue={q?.wrong2} required /></label>
        <label className="field">Wrong answer 3<input id="wrong3" name="wrong3" type="text" defaultValue={q?.wrong3} required /></label>
      </div>
      <label className="field">Explanation<span className="hint">Shown to students after a practice question. One or two plain sentences.</span><textarea id="explanation" name="explanation" defaultValue={q?.explanation} style={{ fontFamily: "inherit", fontSize: ".95rem", minHeight: 70 }} /></label>
      <label className="check"><input type="checkbox" name="reviewed" id="reviewed" defaultChecked={q?.reviewed} />Reviewed by a certified teacher</label>
      <div><button className="btn primary">{q ? "Save question" : "Add question"}</button></div>
    </form>
  );
}
