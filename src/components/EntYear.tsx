import Link from "next/link";
import { learnHref } from "@/lib/links";
import { ENT, ENT_NAME, UNITS, bandOf, BAND_LABEL, linksFor, skillsOf, unitFor } from "@/lib/presumptuous";
import { MONTHS } from "@/lib/dates";
import { Info } from "./Info";

/** The Presumptuous Project learning strand for the year, with what's mastered. */
export function EntYear({ grade, mastered, today, self, projectTitle }: { grade: number; mastered: Set<string>; today: Date; self: boolean; projectTitle?: string | null }) {
  const current = unitFor(today);
  const all = UNITS.flatMap(u => skillsOf(u, grade));
  const done = all.filter(s => mastered.has(`${ENT}|${s.skill}`)).length;
  return (
    <section className="stack" id="presumptuous">
      <div className="spread">
        <h2>Presumptuous Project: {ENT_NAME}<Info label="Business and life skills">{`Alongside their own business${projectTitle ? ` (${projectTitle})` : ""}, every student learns two business skills and one life skill each month, taught with the same lessons and mastery checks as academics. It's pitched for ${BAND_LABEL[bandOf(grade)]}, earlier than the Ontario curriculum asks. Each unit lists the Ontario curriculum it supports, so this time also counts toward math and language.`}</Info></h2>
        <span className="small muted num">{done} of {all.length} mastered this year</span>
      </div>
      <div className="ent-year">
        {UNITS.map(u => {
          const skills = skillsOf(u, grade);
          const isNow = u === current;
          return (
            <div key={u.title} className={`card tight ${isNow ? "now" : ""}`}>
              <span className="eyebrow">{MONTHS[u.month]}{isNow ? " · this month" : ""}</span>
              <b>{u.title}</b>
              <div className="chips">{skills.map(s => {
                const m = mastered.has(`${ENT}|${s.skill}`);
                const label = `${m ? "✓ " : ""}${s.skill}${s.kind === "life" ? " · life" : ""}`;
                return self && !m ? <Link key={s.skill} href={learnHref(ENT, grade, s.skill)} className="chip" style={{ textDecoration: "none" }}>{label}</Link> : <span key={s.skill} className={`chip ${m ? "above" : ""}`}>{label}</span>;
              })}</div>
              <span className="small muted">Supports {linksFor(u, grade).join(" · ")}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
