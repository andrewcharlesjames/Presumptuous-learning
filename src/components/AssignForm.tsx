"use client";
import { useMemo, useState } from "react";
import { createAssignment } from "@/app/coach/assign-actions";

type Menu = Record<string, Record<number, string[]>>;
const gradeName = (g: number) => (g === 0 ? "Kindergarten" : g === 13 ? "Beyond Grade 12" : `Grade ${g}`);

/** Assign a skill, practice or a retake to selected students. */
export function AssignForm({ students, menu, subjects, returnTo, defaultGrade }: {
  students: { id: string; name: string }[]; menu: Menu; subjects: { id: string; name: string }[]; returnTo: string; defaultGrade: number;
}) {
  const [kind, setKind] = useState("MASTER_SKILL");
  const [subject, setSubject] = useState(subjects[0]?.id ?? "math");
  const grades = useMemo(() => Object.keys(menu[subject] ?? {}).map(Number).sort((a, b) => a - b), [menu, subject]);
  const [grade, setGrade] = useState(defaultGrade);
  const g = grades.includes(grade) ? grade : grades[0] ?? defaultGrade;
  const skills = menu[subject]?.[g] ?? [];
  return (
    <form action={createAssignment} className="card">
      <h3>Assign work</h3>
      <input type="hidden" name="returnTo" value={returnTo} />
      <div className="form-grid">
        <label className="field">What<select id="as-kind" name="kind" value={kind} onChange={e => setKind(e.target.value)}>
          <option value="MASTER_SKILL">Learn and master a skill</option>
          <option value="PRACTICE">Practise a skill</option>
          <option value="ASSESSMENT">Retake the assessment</option>
        </select></label>
        {kind !== "ASSESSMENT" && <>
          <label className="field">Subject<select id="as-subject" name="subject" value={subject} onChange={e => setSubject(e.target.value)}>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></label>
          <label className="field">Grade level<select id="as-grade" name="grade" value={g} onChange={e => setGrade(Number(e.target.value))}>
            {grades.map(x => <option key={x} value={x}>{gradeName(x)}</option>)}
          </select></label>
          <label className="field">Skill<select id="as-skill" name="skill">{skills.map(s => <option key={s} value={s}>{s}</option>)}</select></label>
        </>}
        <label className="field">Due<span className="hint">Optional</span><input id="as-due" name="dueDate" type="date" /></label>
      </div>
      <label className="field">Note to students<span className="hint">Optional, shown with the assignment</span><input id="as-note" name="note" type="text" maxLength={300} /></label>
      {students.length > 1 ? (
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontWeight: 600, fontSize: ".92rem", marginBottom: 6 }}>Students</legend>
          <div className="grid3">{students.map(s => (
            <label key={s.id} className="check"><input type="checkbox" name="student" value={s.id} id={`as-st-${s.id}`} defaultChecked />{s.name}</label>
          ))}</div>
        </fieldset>
      ) : students.map(s => <input key={s.id} type="hidden" name="student" value={s.id} />)}
      <div><button className="btn primary">Assign</button></div>
    </form>
  );
}
