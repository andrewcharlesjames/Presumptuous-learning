import Link from "next/link";
import { learnHref } from "@/lib/links";
import { startPractice } from "@/app/student/practice/actions";
import { startAssessment, startCheckup } from "@/app/student/actions";
import { dayName, type Todo } from "@/lib/week";
import { fmtDate } from "@/lib/dates";

const TONE: Record<Todo["kind"], string> = { learn: "learn", ent: "ent", assignment: "assign", step: "step", "start-project": "step", checkup: "checkup" };

/** The button that does the task: a lesson, a practice set, an assessment, or the project page. */
export function TodoAction({ t, big = false, readOnly = false }: { t: Todo; big?: boolean; readOnly?: boolean }) {
  if (readOnly || t.done) return null;
  const cls = `btn ${big ? "" : "small "}primary`;
  if (t.kind === "checkup") return t.inProgress
    ? <Link className={cls} href="/student/assessment">Continue the check-up</Link>
    : <form action={startCheckup}><button className={cls}>Start the check-up</button></form>;
  if (t.kind === "step" || t.kind === "start-project") {
    const label = t.kind === "start-project" ? "Start it" : t.status === "NEEDS_WORK" ? "Fix and resend" : "Open this step";
    return <Link className={cls} href={t.href!}>{label}</Link>;
  }
  if (t.kind === "assignment" && t.assignmentKind === "ASSESSMENT")
    return <form action={startAssessment}><input type="hidden" name="fresh" value="1" /><button className={cls}>Start the assessment</button></form>;
  if (t.kind === "assignment" && t.assignmentKind === "PRACTICE")
    return <form action={startPractice}><input type="hidden" name="subject" value={t.subject} /><input type="hidden" name="skill" value={t.skill} /><input type="hidden" name="grade" value={t.grade} /><button className={cls}>Practice now</button></form>;
  return <Link className={cls} href={learnHref(t.subject!, t.grade!, t.skill!)}>Learn it</Link>;
}

function when(t: Todo, todayIso: string) {
  if (t.done) return t.kind === "step" ? "Sent to your coach" : "Done";
  if (t.kind === "start-project") return "Not started yet";
  if (t.status === "NEEDS_WORK") return "Your coach asked for changes";
  if (!t.day) return "This week";
  if (t.day === todayIso) return "Today";
  if (t.late) return t.kind === "step" ? `Was due ${fmtDate(new Date(`${t.day}T00:00:00Z`), { month: "short", day: "numeric" })}` : `From ${dayName(t.day)}`;
  return t.day <= addWeek(todayIso) ? dayName(t.day) : `Due ${fmtDate(new Date(`${t.day}T00:00:00Z`), { month: "short", day: "numeric" })}`;
}
const addWeek = (iso: string) => new Date(new Date(`${iso}T00:00:00Z`).getTime() + 6 * 86400000).toISOString().slice(0, 10);

/** A bold task card. */
export function TodoCard({ t, todayIso, readOnly = false }: { t: Todo; todayIso: string; readOnly?: boolean }) {
  const label = when(t, todayIso);
  return (
    <article className={`ncard ${TONE[t.kind]} ${t.done ? "done" : ""} ${t.late || t.status === "NEEDS_WORK" ? "late" : ""}`}>
      <div className="ncard-top"><span className="eyebrow">{t.eyebrow}</span><span className="when">{t.done ? "✓ " : ""}{label}</span></div>
      <h3>{t.title}</h3>
      {t.note && <p className="small">“{t.note}”</p>}
      <div className="ncard-foot"><TodoAction t={t} readOnly={readOnly} /></div>
    </article>
  );
}

/** The one thing to do next, as a large card. */
export function HeroCard({ eyebrow, title, body, action, tone = "accent" }: { eyebrow: string; title: string; body?: string; action?: React.ReactNode; tone?: "accent" | "late" | "calm" }) {
  return (
    <section className={`hero-card ${tone}`} aria-labelledby="up-next">
      <span className="eyebrow">{eyebrow}</span>
      <h2 id="up-next">{title}</h2>
      {body && <p>{body}</p>}
      {action && <div className="row">{action}</div>}
    </section>
  );
}

export function CardGrid({ children }: { children: React.ReactNode }) {
  return <div className="news">{children}</div>;
}
