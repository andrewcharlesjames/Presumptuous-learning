import Link from "next/link";
import { Logo } from "@/components/Logo";
import { getUser, homeFor } from "@/lib/auth";
import { requestPilot } from "./pilot-actions";

export const metadata = {
  title: "Presumptuous Learning: Ontario K–12, planned above grade level",
  description: "Assess every Ontario subject, plan every day above grade level, teach until mastery, report to families, and run the Presumptuous and Purpose Projects. Built for schools.",
};

const STEPS = [
  { n: "1", t: "Assess", d: "An adaptive placement in every subject of the student's Ontario curriculum finds the level they really work at: below, at or above grade." },
  { n: "2", t: "Plan", d: "A plan for today, this month and the school year, aimed one level higher than where the student is now." },
  { n: "3", t: "Learn and master", d: "AI lessons teach each skill, then a mastery check tests it. Miss it and the lesson is taught again a different way, until they get it." },
  { n: "4", t: "Build", d: "Every student runs a Presumptuous Project (their own business, with business and life skills lessons every month) and a Purpose Project (a community give-back), September to June." },
  { n: "5", t: "Show", d: "Students present on Launch Day in May. Families follow along every week and get report cards in Ontario's format." },
];

const SHOTS = [
  { src: "/screens/today.webp", w: 1080, h: 820, t: "A student's day", d: "Check in, the plan inside your timetable, arts, the Presumptuous Project and reflection, with a streak for finishing the day." },
  { src: "/screens/placement.webp", w: 1080, h: 760, t: "Placement in every subject", d: "Where the student works now, and exactly which skills take them to the next level." },
  { src: "/screens/report.webp", w: 1040, h: 900, t: "Report cards families can print", d: "Ontario's learning skills and marks, with comments drafted from the student's work for the coach to finish." },
];

const ROLES = [
  { t: "Coaches", d: ["Who needs attention today, at a glance.", "Assign skills, practice or a reassessment to one student or the class.", "Feedback on studio work and project milestones, and report cards half-written for them."] },
  { t: "School leaders", d: ["Placement across the school by subject and grade.", "Your timetable and calendar drive every student's day.", "Licences, seats and invoices in one place, plus audit log, consent records and data exports."] },
];

const PARENTS = [
  { t: "Every subject, in plain words", d: "Where your child is (below, at or above grade level) and the exact skills they're working on next." },
  { t: "A Friday email", d: "Days completed, skills mastered, project steps and notes from their coach. One click to stop it." },
  { t: "Report cards", d: "A fall progress report and two report cards a year, in Ontario's format, ready to print." },
  { t: "Free, and you're in control", d: "Families never pay. You give or withdraw consent for AI features and can download your child's data any time." },
];

const INCLUDED = [
  "Adaptive placement, K–12", "Daily, monthly and yearly plans", "AI lessons and mastery checks", "AI tutor (optional)",
  "Your bell schedule and calendar", "Studio and portfolio", "Presumptuous and Purpose Projects", "Business & life skills strand, K–12", "Launch Day showcase",
  "Ontario-format report cards", "Weekly parent email", "QR sign-in cards for young students", "Sign in with Google or Microsoft",
];

const FAQ = [
  { q: "Does it replace teachers?", a: "No. We call the adults who work with students coaches: your teachers, ECEs and support staff. The platform does the assessing, planning, first teaching and checking, so coaches can spend their time with the students who need them most." },
  { q: "Does it follow the Ontario curriculum?", a: "Yes. Every grade from Kindergarten to Grade 12 is assessed in the subjects of the Ontario curriculum, results use the achievement levels 1 to 4, and report cards follow the provincial format: progress words in the fall, letter grades for Grades 1 to 6, percentages from Grade 7, and the six learning skills." },
  { q: "How much time does it take each day?", a: "It fits the timetable you already have. The plan fills your academic blocks in short pieces: a lesson with a 5-question check, or a 5-question practice set. Students check in each morning and reflect at the end of the day. By default the week holds 10 hours of academics and 8 hours of Presumptuous Project time, with the business lessons tied to Ontario math and language expectations." },
  { q: "What devices does it need?", a: "Any device with a web browser: Chromebooks, iPads, laptops or phones. Nothing to install. Young students can sign in by holding up a printed QR card to the camera." },
  { q: "How is AI used, and is it safe?", a: "AI writes the lessons for each skill and, if your school switches it on, short explanations of wrong practice answers. It never receives a student's name. Schools can require a parent's consent first, and every view of a student's records is logged." },
  { q: "What does it cost?", a: "Schools pay one price per student per year, with every feature included. Coaches, parents and admins are free, and families never pay. Every school starts with a 90-day pilot." },
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
          <a className="navlink" href="#parents">For parents</a>
          <a className="navlink" href="#faq">Questions</a>
          <a className="navlink" href="#pricing">Pricing</a>
          {user ? <Link className="btn primary" href={homeFor(user.role)}>Go to my dashboard</Link>
            : <><Link className="btn" href="/login">Sign in</Link><a className="btn primary" href="#pilot">Request a pilot</a></>}
        </nav>
      </header>
      <main className="stack-lg">
        <section className="hero">
          <span className="eyebrow">For Ontario schools · Kindergarten to Grade 12</span>
          <h1>Overreaching is how students get ahead.</h1>
          <p className="subhead">Reaching beyond what&apos;s expected.</p>
          <p className="lede">
            Every student can work above grade level. We plan for it. Presumptuous Learning assesses every subject in a
            student&apos;s Ontario curriculum, plans each day one level higher, teaches until each skill is mastered, and gives
            every student a business and a give-back project to launch by May. Families see it all, every week.
          </p>
          <div className="row">
            <a className="btn primary" href="#pilot">Request a 90-day pilot</a>
            {!user && <Link className="btn" href="/join">Parents: join with a family code</Link>}
          </div>
        </section>

        <section className="stack" aria-labelledby="see-it">
          <span className="eyebrow">See it</span>
          <h2 id="see-it">What students, coaches and families see</h2>
          <div className="shots">
            {SHOTS.map(s => (
              <figure key={s.src} className="shot">
                <a className="frame" href={s.src} target="_blank" rel="noopener" title="Open full size"><img src={s.src} width={s.w} height={s.h} alt={`Screenshot: ${s.t} (opens full size)`} loading="lazy" /></a>
                <figcaption><b>{s.t}</b><span>{s.d}</span></figcaption>
              </figure>
            ))}
          </div>
          <p className="small muted">Screens from our demo school. Names are made up.</p>
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

        <section className="student-band">
          <span className="eyebrow">For students</span>
          <p className="big">Your plan. Your streak. Your business. Your Launch Day.</p>
          <p>Every morning you check in and set a goal. You learn what&apos;s next for you, not what&apos;s next for everyone. Get it right and you move up; miss it and you get it explained a new way. And by May, you&apos;ve started something real.</p>
        </section>

        <section id="parents" className="stack">
          <span className="eyebrow">For parents</span>
          <h2>Know where your child is, every week</h2>
          <div className="grid4">
            {PARENTS.map(p => <div className="feature" key={p.t}><h3>{p.t}</h3><p>{p.d}</p></div>)}
          </div>
          <p className="muted">Your child&apos;s school gives you a family code. <Link href="/join">Use it to create your account</Link>.</p>
        </section>

        <section className="stack">
          <span className="eyebrow">For schools</span>
          <h2>For coaches and school leaders</h2>
          <p className="muted" style={{ maxWidth: "70ch" }}>We call the adults who work with students <b>coaches</b>: your teachers, ECEs and support staff. The platform does the planning and first teaching so they can coach.</p>
          <div className="grid2">
            {ROLES.map(r => (
              <div className="feature" key={r.t}><h3>{r.t}</h3><ul className="ticks">{r.d.map(x => <li key={x}>{x}</li>)}</ul></div>
            ))}
          </div>
        </section>

        <section className="grid2 band">
          <div className="stack">
            <span className="eyebrow">The school day</span>
            <h2>Follows your timetable, September to June</h2>
            <p className="muted">Each student&apos;s Today screen follows your bell schedule and school calendar: morning check-in, core academics from their plan, the Presumptuous Project, arts in the studio, and an end-of-day reflection. By default students spend 10 hours a week on academics and 8 on their Presumptuous Project. PA days, holidays and breaks come from your calendar, with the Ontario template built in.</p>
          </div>
          <div className="stack">
            <span className="eyebrow">Teaches, then tests</span>
            <h2>Until they get it</h2>
            <p className="muted">When the plan says a student needs a skill, the platform teaches it with a short lesson at their level, checks it with five questions, and reteaches it a new way if they miss. Coaches are told when a student is stuck after three tries.</p>
          </div>
        </section>

        <section id="projects" className="stack">
          <span className="eyebrow">Projects and Launch Day</span>
          <h2>Every student launches something real</h2>
          <div className="grid2">
            <div className="feature"><span className="eyebrow">Life Skills · Business</span><h3>Presumptuous Project</h3><p>A real business the student designs, tests with customers and launches. Every month brings two business skills and one life skill, from pricing and profit to pitching and resilience, taught with lessons and mastery checks and used straight away on their own business.</p></div>
            <div className="feature"><span className="eyebrow">Community impact</span><h3>Purpose Project</h3><p>A community impact project: a cause they care about, a partner, a plan, and numbers that show what changed.</p></div>
          </div>
          <p className="muted">An AI discovery interview helps each student find a project that fits them. Nine milestones run from September to June, each reviewed by a coach, with presentations on Launch Day in May. We start younger than the Ontario curriculum: Kindergarten to Grade 2 already meet price, cost and profit at a lemonade stand. Each unit is tied to Ontario math and language expectations, such as financial literacy, data and oral communication, so the time counts toward academics too.</p>
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

        <section id="faq" className="stack">
          <span className="eyebrow">Questions</span>
          <h2>What schools and parents ask us</h2>
          <div className="faq">
            {FAQ.map(f => (
              <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>
            ))}
          </div>
        </section>

        <section id="pricing" className="card pricing">
          <span className="eyebrow">Pricing</span>
          <h2>One price per student, per year</h2>
          <p>Every feature is included. Coaches, parents and admins are free, and families never pay. Every school starts with a 90-day pilot.</p>
          <ul className="included">{INCLUDED.map(x => <li key={x}>{x}</li>)}</ul>
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
        <span>© {new Date().getFullYear()} Presumptuous Learning · Reaching beyond what&apos;s expected.</span>
        <Link href="/privacy" style={{ color: "inherit" }}>Privacy notice</Link>
        <Link href="/login" style={{ color: "inherit" }}>Sign in</Link>
      </footer>
    </div>
  );
}
