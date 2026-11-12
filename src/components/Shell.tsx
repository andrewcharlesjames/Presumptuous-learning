import type { CurrentUser } from "@/lib/auth";
import { readFlash } from "@/lib/flash";
import { db } from "@/lib/db";
import { todayIn } from "@/lib/dates";
import { licenceState } from "@/lib/licence";
import { Logo } from "./Logo";
import { NavLinks } from "./NavLinks";
import { FlashClear } from "./FlashClear";
import { signOut } from "@/app/login/actions";

const ROLE_LABEL = { PLATFORM_ADMIN: "Platform admin", SCHOOL_ADMIN: "School admin", COACH: "Coach", PARENT: "Parent", STUDENT: "Student" } as const;

export function navFor(user: CurrentUser): { href: string; label: string }[] {
  switch (user.role) {
    case "PLATFORM_ADMIN": return [{ href: "/admin", label: "Schools" }, { href: "/admin/questions", label: "Question bank" }, { href: "/admin/lessons", label: "Lessons" }, { href: "/admin/leads", label: "Pilot requests" }];
    case "SCHOOL_ADMIN": return [
      { href: "/school", label: "Overview" }, { href: "/school/people", label: "People" }, { href: "/school/classes", label: "Classes" },
      { href: "/school/schedule", label: "School day" }, { href: "/school/calendar", label: "Calendar" }, { href: "/showcase", label: "Showcase" }, { href: "/school/privacy", label: "Privacy" }, { href: "/school/billing", label: "Billing" }, { href: "/school/settings", label: "Settings" },
    ];
    case "COACH": return [{ href: "/coach", label: "My classes" }, { href: "/showcase", label: "Showcase" }];
    case "PARENT": return [{ href: "/parent", label: "My children" }, { href: "/showcase", label: "Showcase" }];
    case "STUDENT": return [{ href: "/student", label: "Today" }, { href: "/student/studio", label: "Studio" }, { href: "/student/projects", label: "Projects" }, { href: `/students/${user.id}/portfolio`, label: "Portfolio" }, { href: `/students/${user.id}`, label: "My plan" }];
  }
}

export async function Shell({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  const flash = await readFlash();
  let licenceWarn: string | null = null;
  if (user.school && (user.role === "SCHOOL_ADMIN" || user.role === "COACH")) {
    const used = user.role === "SCHOOL_ADMIN" ? await db.user.count({ where: { schoolId: user.school.id, role: "STUDENT", active: true } }) : 0;
    const st = licenceState(user.school, todayIn(user.school.timezone), used);
    // Coaches only hear about an ended licence; admins also see renewals coming up and seat overages.
    licenceWarn = user.role === "SCHOOL_ADMIN" ? st.warn : st.daysLeft !== null && st.daysLeft < 0 ? "Your school's licence has ended. Your school admin can renew it." : null;
  }
  const role = user.role === "COACH" ? (user.school?.coachTitle ?? "Coach") : ROLE_LABEL[user.role];
  return (
    <div className="wrap">
      <header className="topbar">
        <Logo href="/" />
        <NavLinks items={navFor(user)} />
        <div className="who">
          <span className="muted">{user.firstName} · {role}{user.school ? ` · ${user.school.name}` : ""}</span>
          <form action={signOut}><button className="btn small" type="submit">Sign out</button></form>
        </div>
      </header>
      <main className="stack-lg">
        {flash && (
          <div className={`flash ${flash.tone}`} role="status">
            <FlashClear />
            <span>{flash.text}</span>
            {flash.secret?.map(s => (
              <span className="secret" key={s.label}>{s.label}: <code>{s.value}</code></span>
            ))}
            {flash.secret && <span className="small muted">Copy this now. It won't be shown again.</span>}
          </div>
        )}
        {licenceWarn && (
          <p className="flash error licence-warn">
            <span>{licenceWarn}{user.role === "SCHOOL_ADMIN" && <> <a href="/school/billing">Plan &amp; billing</a></>}</span>
          </p>
        )}
        {children}
      </main>
      <footer className="small muted" style={{ marginTop: 40, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
        <a href="/privacy" style={{ color: "inherit" }}>Privacy notice</a>
      </footer>
    </div>
  );
}
