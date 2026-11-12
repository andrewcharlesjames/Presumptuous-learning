import type { Status, StoredResult } from "@/lib/assessment";
import { STATUS_LABEL } from "@/lib/assessment";
import { SUBJECT_BY_ID, gradeShort } from "@/lib/subjects";
import type { SubjectId } from "@/lib/bank";

const ABBR: Record<SubjectId, string> = { lang: "Lang", math: "Math", sci: "Sci", soc: "Soc", fsl: "Fr", arts: "Arts", hpe: "HPE", tech: "Tech", bus: "Bus", ssh: "SSH", gce: "Career" };

export function StatusPill({ status }: { status: Status | null }) {
  if (!status) return <span className="pill none">Not assessed</span>;
  return <span className={`pill ${status}`}>{STATUS_LABEL[status]}</span>;
}

/** Compact per-subject chips, e.g. for a roster row. */
export function SubjectChips({ results, grade }: { results: StoredResult[]; grade: number }) {
  return (
    <span className="chips">
      {results.map(r => (
        <span key={r.sid} className={`chip ${r.status}`} title={`${SUBJECT_BY_ID[r.sid].name(grade)}: ${STATUS_LABEL[r.status]} (Level ${r.level})`}>
          {ABBR[r.sid]} {r.level}
        </span>
      ))}
    </span>
  );
}

export function Ruler({ status, grade }: { status: Status; grade: number }) {
  const cells: [Status, number][] = [["below", grade - 1], ["at", grade], ["above", grade + 1]];
  return (
    <div className="ruler" aria-label={STATUS_LABEL[status]}>
      {cells.map(([st, g]) => (
        <div key={st} className={`seg ${st} ${status === st ? "on" : ""}`}>{g < 0 ? "Pre-K" : `Gr ${gradeShort(g)}`}</div>
      ))}
    </div>
  );
}

/** Stacked bar of below / at / above counts. */
export function SplitBar({ below, at, above }: { below: number; at: number; above: number }) {
  const t = below + at + above || 1;
  return (
    <span className="bar" aria-label={`${below} below, ${at} at, ${above} above`}>
      <i className="b" style={{ width: `${(below / t) * 100}%` }} />
      <i className="a" style={{ width: `${(at / t) * 100}%` }} />
      <i className="v" style={{ width: `${(above / t) * 100}%` }} />
    </span>
  );
}
