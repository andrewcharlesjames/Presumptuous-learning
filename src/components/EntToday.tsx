import Link from "next/link";
import { learnHref } from "@/lib/links";
import { ENT, applyText, skillsOf, type Unit } from "@/lib/presumptuous";
import { Info } from "./Info";

/** The Presumptuous Project block: this month's business and life skills, then apply one to your own business. */
export function EntToday({ unit, grade, mastered, projectTitle, compact = false }: { unit: Unit; grade: number; mastered: Set<string>; projectTitle?: string | null; compact?: boolean }) {
  const skills = skillsOf(unit, grade);
  const next = skills.find(s => !mastered.has(`${ENT}|${s.skill}`));
  return (
    <div className="stack ent-today" style={{ gap: 8, marginTop: 4 }}>
      <p className="small"><b>This month: {unit.title}</b>
        <Info label="Presumptuous Project learning">{"Each month has two business skills and one life skill, lined up with your project's next step. Learn it gives you a short lesson and a 5-question check: get 4 right and it's mastered. Then use it on your own business with Apply it."}</Info></p>
      <div className="chips">{skills.map(s => {
        const done = mastered.has(`${ENT}|${s.skill}`);
        return <Link key={s.skill} href={learnHref(ENT, grade, s.skill)} className={`chip ${done ? "above" : ""}`} style={{ textDecoration: "none" }}>{done ? "✓ " : ""}{s.skill}{s.kind === "life" ? " · life skill" : ""}</Link>;
      })}</div>
      {next ? (
        <div className="row" style={{ gap: 8 }}>
          <Link className="btn small primary" href={learnHref(ENT, grade, next.skill)}>Learn it: {next.skill}</Link>
        </div>
      ) : <p className="small"><span className="pill above">All of this month&apos;s skills mastered</span></p>}
      {!compact && <p className="small"><b>Apply it:</b> {applyText(unit, projectTitle)}</p>}
    </div>
  );
}
