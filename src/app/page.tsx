import Link from "next/link";
import { Logo } from "@/components/Logo";
import { getUser, homeFor } from "@/lib/auth";

export default async function Home() {
  const user = await getUser();
  return (
    <div className="wrap">
      <header className="topbar">
        <Logo />
        <div className="row">
          {user ? <Link className="btn primary" href={homeFor(user.role)}>Go to my dashboard</Link>
            : <><Link className="btn" href="/join">Parents: join</Link><Link className="btn primary" href="/login">Sign in</Link></>}
        </div>
      </header>
      <main className="stack-lg">
        <section className="hero">
          <span className="eyebrow">Ontario curriculum · Kindergarten to Grade 12</span>
          <h1>Overreaching is how students get ahead.</h1>
          <p className="lede">
            Every student can work above grade level. We plan for it. Presumptuous Learning assesses every subject in a
            student&apos;s Ontario curriculum, places each one below, at or above grade level, and builds a plan for the day,
            the month and the school year. Coaches see exactly what each student needs to reach the next level, and parents
            see it too.
          </p>
          <div className="row"><Link className="btn primary" href="/login">Sign in</Link><Link className="btn" href="/join">Parents: join with a family code</Link></div>
        </section>
        <section className="grid3">
          <div className="feature"><span className="eyebrow">Assess</span><h3>Every subject, every grade</h3><p>About seven questions per subject, from the grade below to the grade above, mapped to Ontario achievement levels 1 to 4.</p></div>
          <div className="feature"><span className="eyebrow">Plan</span><h3>Built around the school day</h3><p>Plans follow your school&apos;s timetable and calendar, from morning assembly to reflection, September to June.</p></div>
          <div className="feature"><span className="eyebrow">Coach</span><h3>Everyone sees the same picture</h3><p>Students, parents and coaches each get their own view of where a student is and what comes next.</p></div>
        </section>
      </main>
      <footer className="small muted" style={{ marginTop: 40, paddingTop: 16, borderTop: "1px solid var(--line)" }}><Link href="/privacy" style={{ color: "inherit" }}>Privacy notice</Link></footer>
    </div>
  );
}
