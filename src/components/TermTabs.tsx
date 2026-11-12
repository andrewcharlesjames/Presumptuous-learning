import Link from "next/link";
import { TERMS, type Term } from "@/lib/report-rules";

export function TermTabs({ base, term, extra = "" }: { base: string; term: Term; extra?: string }) {
  return (
    <nav className="tabs noprint" aria-label="Report">
      {TERMS.map(t => <Link key={t.n} className="tab" aria-current={t.n === term ? "page" : undefined} href={`${base}?term=${t.n}${extra}`}>{t.short}</Link>)}
    </nav>
  );
}
