import Link from "next/link";
import { CardGrid, HeroCard, TodoAction, TodoCard } from "./Cards";
import { Info } from "./Info";
import { dayName, type Todo, type WeekBoard } from "@/lib/week";
import { fmtDate } from "@/lib/dates";

/** The top of a student's Today page: one big "up next" card, then today's work, catch-up and projects as cards. */
export function StudentCards({ board, schoolDay, reason, checkedIn, reflected, hasAssembly, hasReflection, coachTitle }: {
  board: WeekBoard; schoolDay: boolean; reason: string | null; checkedIn: boolean; reflected: boolean; hasAssembly: boolean; hasReflection: boolean; coachTitle: string;
}) {
  const { todayIso } = board;
  const catchUp = board.catchUp.filter(t => t.kind !== "step" && t.kind !== "start-project");
  const todayOpen = board.today.filter(t => !t.done && t.kind !== "step");
  const later = board.later.filter(t => t.kind === "assignment");
  const behind = board.behind;
  const stepDue = (t: Todo) => t.day ? fmtDate(new Date(`${t.day}T00:00:00Z`), { weekday: "long", month: "long", day: "numeric" }) : "";

  // the single most useful next thing
  let hero: React.ReactNode;
  if (schoolDay && !checkedIn) {
    hero = <HeroCard eyebrow="Start your day" title="Check in" body="Tell us how you're feeling and set one goal. It takes a minute." action={<a className="btn primary" href="#block-ASSEMBLY">Check in</a>} />;
  } else if (behind.length) {
    const b = behind[0];
    hero = <HeroCard tone="late" eyebrow={`You're behind · ${b.eyebrow}`} title={b.kind === "start-project" ? b.title : b.title}
      body={b.kind === "start-project" ? "Every student runs one this year. Answer a few questions and get ideas made just for you." : b.status === "NEEDS_WORK" ? `Your ${coachTitle.toLowerCase()} asked for a few changes. Fix them and send it back.` : `This step was due ${stepDue(b)}. Finish it to get back on track for Launch Day.`}
      action={<TodoAction t={b} big />} />;
  } else if (catchUp.length) {
    const c = catchUp[0];
    hero = <HeroCard eyebrow={`Catch up · from ${c.day ? dayName(c.day) : "this week"} · ${catchUp.length} left`} title={c.title} body={c.eyebrow} action={<TodoAction t={c} big />} />;
  } else if (todayOpen.length) {
    const t = todayOpen[0];
    hero = <HeroCard eyebrow={`Up next · ${t.eyebrow}`} title={t.title} body={todayOpen.length > 1 ? `Then ${todayOpen.length - 1} more for today.` : "Last one for today."} action={<TodoAction t={t} big />} />;
  } else if (schoolDay && !reflected) {
    hero = <HeroCard eyebrow="Finish your day" title="Reflect" body="One thing you learned and one question you still have. Then your day is complete." action={<a className="btn primary" href="#block-REFLECTION">Reflect</a>} />;
  } else {
    const next = board.later.find(t => t.kind !== "step");
    hero = <HeroCard tone="calm" eyebrow={schoolDay ? "All done for today" : `No school today${reason ? ` · ${reason}` : ""}`} title={next ? "Want to get ahead?" : "You're all caught up"}
      body={next ? `Next: ${next.title} (${next.eyebrow}).` : "Nothing left this week. Practise anything on your plan, or work on your projects."}
      action={next ? <TodoAction t={next} big /> : <Link className="btn primary" href="/student/week">See my week</Link>} />;
  }
  void hasAssembly; void hasReflection;

  return (
    <>
      {hero}

      {behind.length > 0 && (
        <section className="stack">
          <div className="section-head"><h2>Your projects need you<Info label="Behind on a project">{"A project step is late, your coach asked for changes, or you haven't started a project yet. Each step builds toward Launch Day in May, so catching up now keeps you on track."}</Info></h2></div>
          <CardGrid>{behind.map(t => <TodoCard key={t.id} t={t} todayIso={todayIso} />)}</CardGrid>
        </section>
      )}

      {catchUp.length > 0 && (
        <section className="stack">
          <div className="section-head"><h2>Catch up<Info label="Catch up">{"Work from earlier this week that isn't done yet. Do it any day, even on the weekend: it counts as soon as you finish it. It won't change the days you missed, but your week will be complete."}</Info></h2><span className="small muted">{catchUp.length} from earlier this week</span></div>
          <CardGrid>{catchUp.slice(0, 4).map(t => <TodoCard key={t.id} t={t} todayIso={todayIso} />)}</CardGrid>
          {catchUp.length > 4 && <p><Link className="btn" href="/student/week">See all {catchUp.length} in My week →</Link></p>}
        </section>
      )}

      {schoolDay && board.today.length > 0 && (
        <section className="stack">
          <div className="section-head"><h2>Today&apos;s work<Info label="Today's work">{"Your lessons for today, picked from your plan. Learn it gives you a short lesson, then 5 questions: get 4 right and you've mastered it. Cards turn grey with a tick when they're done."}</Info></h2>
            <span className="small muted">{board.today.filter(t => t.done).length} of {board.today.length} done</span></div>
          <CardGrid>{board.today.map(t => <TodoCard key={t.id} t={t} todayIso={todayIso} />)}</CardGrid>
        </section>
      )}

      {later.length > 0 && (
        <section className="stack">
          <div className="section-head"><h2>Coming up</h2></div>
          <CardGrid>{later.slice(0, 4).map(t => <TodoCard key={t.id} t={t} todayIso={todayIso} />)}</CardGrid>
        </section>
      )}

      <p><Link className="btn" href="/student/week">See my whole week →</Link> <span className="small muted">{board.doneCount} of {board.total} done this week</span></p>
    </>
  );
}
