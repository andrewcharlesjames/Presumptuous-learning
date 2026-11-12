import Link from "next/link";
import { Logo } from "@/components/Logo";
import { getUser, homeFor } from "@/lib/auth";
import { requestPilot } from "./pilot-actions";

export const metadata = {
  title: "Presumptuous Learning: Ontario K–12, planned above grade level",
  description: "Assess every Ontario subject, plan every day above grade level, teach until mastery, and run the Life Skills and Purpose Projects. Built for schools.",
};

const STEPS = [
  { n: "1", t: "Assess", d: "An adaptive placement in every subject of the student's Ontario curriculum finds the level they really work at: below, at or above grade." },
  { n: "2", t: "Plan", d: "A plan for today, this month and the school year, aimed one level higher than where the student is now." },
  { n: "3", t: "Learn and master", d: "AI lessons teach each skill, then a mastery check tests it. Miss it and the lesson is taught again a different way, until they get it." },
  { n: "4", t: "Build", d: "Every student runs a Life Skills Project (a business) and a Purpose Project (a community give-back) from September to June." },
  { n: "5", t: "Show", d: "Students present on Launch Day in May. Their best work lives in a portfolio parents and coaches can see all year." },
];

const ROLES = [
  { t: "Students", d: ["One home base every school day: check in, learn, create, reflect.", "Lessons and practice pitched just above their level.", "A streak for showing up and finishing the day."] },
  { t: "Coaches", d: ["Who needs attention today, at a glance.", "Assign skills, practice or a reassessment to one student or the class.", "Feedback on studio work and project milestones."] },
  { t: "Parents", d: ["See exactly where their child is in every subject.", "Follow today's work, mastered skills and projects.", "Control consent and download their child's data."] },
  { t: "School leaders", d: ["Placement across the school by subject and grade.", "Your timetable and calendar drive every student's day.", "Audit log, consent records and data exports."] },
];

const PILOT_MSG: Record<string, { tone: "ok" | "error"; text: string }> = {
  sent: { tone: "ok", text: "Thanks. We'll be in touch within two school days to set up your pilot." },
  error: { tone: "error", text: "Please add your name, school and a valid email, then send it again." },
  busy: { tone: "error", text: "We've had several requests from your network in the last hour. Please try again later." },
};

export default async function Home({ searchParams }: { searchParams: Promise<{ pilot?: string }> }) {
  const user = await getUser();
  const pilot = PILOT_MSG[(await searchParams).pilot ?? ""];
  return (
    <div className="wrap mkt">
      <header className="topbar">
        <Logo />
        <nav className="row" aria-label="Site">
          <a className="navlink" href="#how">How it works</a>
          <a className="navlink" href="#projects">Projects</a>
          <a className="navlink" href="#pricing">Pricing</a>
          {user ? <Link className="btn primary" href={homeFor(user.role)}>Go to my dashboard</Link>
            : <><Link className="btn" href="/login">Sign in</Link><a className="btn primary" href="#pilot">Request a pilot</a></>}
        </nav>
      </header>
      <main className="stack-lg">
        <section className="hero">
          <span className="eyebrow">For Ontario schools · Kindergarten to Grade 12</span>
          <h1>Overreaching is how students get ahead.</h1>
          <p className="lede">
            Every student can work above grade level. We plan for it. Presumptuous Learning assesses every subject in a
            student&apos;s Ontario curriculum, plans each day one level higher, teaches until each skill is mastered, and gives
            every student a business and a give-back project to launch by May.
          </p>
          <div className="row">
            <a className="btn primary" href="#pilot">Request a 90-day pilot</a>
            {!user && <Link className="btn" href="/join">Parents: join with a family code</Link>}
          </div>
        </section>

        <section id="how" className="stack">
          <span className="eyebrow">How it works</span>
          <h2>From placement to Launch Day</h2>
          <ol className="steps">
            {STEPS.map(s => (
              <li key={s.n}><span className="stepn" aria-hidden="true">{s.n}</span><h3>{s.t}</h3><p>{s.d}</p></li>
            ))}
          </ol>
        </section>

        <section className="stack">
          <span className="eyebrow">Everyone sees the same picture</span>
          <h2>A view for every role</h2>
          <div className="grid4">
            {ROLES.map(r => (
              <div className="feature" key={r.t}><h3>{r.t}</h3><ul className="ticks">{r.d.map(x => <li key={x}>{x}</li>)}</ul></div>
            ))}
          </div>
        </section>

        <section className="grid2 band">
          <div className="stack">
            <span className="eyebrow">The school day</span>
            <h2>Follows your timetable, September to June</h2>
            <p className="muted">Each student&apos;s Today screen follows your bell schedule and school calendar: morning check-in, core academics from their plan, arts in the studio, life skills, and an end-of-day reflection. PA days, holidays and breaks come from your calendar, with the Ontario template built in.</p>
          </div>
          <div className="stack">
            <span className="eyebrow">Teaches, then tests</span>
            <h2>Until they get it</h2>
            <p className="muted">When the plan says a student needs a skill, the platform teaches it with a short lesson at their reading level, checks it with five questions, and reteaches it a new way if they miss. Coaches are told when a student is stuck after three tries.</p>
          </div>
        </section>

        <section id="projects" className="stack">
          <span className="eyebrow">Projects and Launch Day</span>
          <h2>Every student launches something real</h2>
          <div className="grid2">
            <div className="feature"><h3>Life Skills Project</h3><p>A business the student designs, tests with real customers and launches. Budgets, pricing, pitching and the courage to sell.</p></div>
            <div className="feature"><h3>Purpose Project</h3><p>A community impact project: a cause they care about, a partner, a plan, and numbers that show what changed.</p></div>
          </div>
          <p className="muted">An AI discovery interview helps each student find a project that fits them. Nine milestones run from September to June, each reviewed by a coach, with presentations on Launch Day in May.</p>
        </section>

        <section className="stack">
          <span className="eyebrow">Privacy and safety</span>
          <h2>Built for school boards&apos; questions</h2>
          <div className="grid3">
            <div className="feature"><h3>Parents in control</h3><p>Consent for the platform and for AI features, given and withdrawn by parents, with paper consent recorded by the school.</p></div>
            <div className="feature"><h3>No names to the AI</h3><p>The tutor sends only the question, the choices, the student&apos;s answer and grade. AI features stay off without consent.</p></div>
            <div className="feature"><h3>Every view logged</h3><p>An audit log of who viewed which student&apos;s records, plus data exports and permanent deletion on request.</p></div>
          </div>
        </section>

        <section id="pricing" className="card pricing">
          <span className="eyebrow">Pricing</span>
          <h2>One price per student, per year</h2>
          <p>Every feature is included: assessments, plans, AI lessons and tutor, the school day, studio and portfolio, both projects and Launch Day. Coaches, parents and admins are free. Every school starts with a 90-day pilot.</p>
          <div><a className="btn primary" href="#pilot">Ask for a quote and a pilot</a></div>
        </section>

        <section id="pilot" className="card">
          <span className="eyebrow">Request a pilot</span>
          <h2>Try it with your students for 90 days</h2>
          <p className="muted">Tell us about your school. We&apos;ll set up your school, timetable and calendar, and help you add your first classes.</p>
          {pilot && <p className={`flash ${pilot.tone}`} role="status"><span>{pilot.text}</span></p>}
          <form action={requestPilot} className="stack">
            <div className="form-grid">
              <label className="field">Your name<input id="lead-name" name="name" type="text" autoComplete="name" required minLength={2} /></label>
              <label className="field">Your role<input id="lead-role" name="role" type="text" placeholder="Principal, teacher, board staff…" /></label>
              <label className="field">School<input id="lead-school" name="schoolName" type="text" autoComplete="organization" required minLength={2} /></label>
            </div>
            <div className="form-grid">
              <label className="field">Email<input id="lead-email" name="email" type="email" autoComplete="email" required /></label>
              <label className="field">Phone (optional)<input id="lead-phone" name="phone" type="tel" autoComplete="tel" /></label>
              <label className="field">About how many students?<input id="lead-students" name="students" type="number" min={1} /></label>
            </div>
            <label className="field">Grades<span className="hint">For example, K–8 or 9–12</span><input id="lead-grades" name="grades" type="text" style={{ maxWidth: 260 }} /></label>
            <label className="field">Anything we should know?<textarea id="lead-message" name="message" rows={3} maxLength={2000} /></label>
            <label className="hp" aria-hidden="true">Website<input name="website" type="text" tabIndex={-1} autoComplete="off" /></label>
            <div><button className="btn primary">Request a pilot</button></div>
          </form>
        </section>
      </main>
      <footer className="small muted" style={{ marginTop: 40, paddingTop: 16, borderTop: "1px solid var(--line)", display: "flex", gap: 16, flexWrap: "wrap" }}>
        <span>© {new Date().getFullYear()} Presumptuous Learning</span>
        <Link href="/privacy" style={{ color: "inherit" }}>Privacy notice</Link>
        <Link href="/login" style={{ color: "inherit" }}>Sign in</Link>
      </footer>
    </div>
  );
}
