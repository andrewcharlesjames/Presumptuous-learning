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

/**
 * Five grades centred on the student's grade. The highlighted cell is the level they showed;
 * the outlined cell is their own grade. Levels beyond the ruler pin to the end cell.
 */
export function Ruler({ status, grade, working }: { status: Status; grade: number; working?: number }) {
  const w = working ?? (status === "above" ? grade + 1 : status === "at" ? grade : grade - 1);
  const lo = Math.max(-1, grade - 2);
  const cells = Array.from({ length: 5 }, (_, i) => lo + i).filter(g => g <= 13);
  const first = cells[0], last = cells[cells.length - 1];
  const onCell = Math.min(last, Math.max(first, w));
  const label = (g: number) => {
    const name = g < 0 ? "Pre-K" : `Gr ${gradeShort(g)}`;
    if (g === onCell && w < first) return `≤${name}`;
    if (g === onCell && w > last) return `≥${name}`;
    return name;
  };
  return (
    <div className="ruler" style={{ gridTemplateColumns: `repeat(${cells.length}, 1fr)` }} aria-label={`${STATUS_LABEL[status]}: working at ${w < 0 ? "pre-Kindergarten" : gradeShort(w) === "K" ? "Kindergarten" : `Grade ${gradeShort(w)}`} level`}>
      {cells.map(g => (
        <div key={g} className={`seg ${status} ${g === onCell ? "on" : ""}`} style={g === grade && g !== onCell ? { boxShadow: "inset 0 0 0 1.5px var(--muted)" } : undefined} title={g === grade ? "Your grade" : undefined}>{label(g)}</div>
      ))}
    </div>
  );
}

/** Stacked bar of below / at / above counts. */
export function SplitBar({ below, at, above }: { below: number; at: number; above: number }) {
  const t = below + at + above || 1;
  return (
    <span className="bar" role="img" aria-label={`${below} below, ${at} at, ${above} above grade level`}>
      <i className="b" style={{ width: `${(below / t) * 100}%` }} />
      <i className="a" style={{ width: `${(at / t) * 100}%` }} />
      <i className="v" style={{ width: `${(above / t) * 100}%` }} />
    </span>
  );
}
