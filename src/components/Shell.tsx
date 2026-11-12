import type { CurrentUser } from "@/lib/auth";
import { readFlash } from "@/lib/flash";
import { Logo } from "./Logo";
import { NavLinks } from "./NavLinks";
import { FlashClear } from "./FlashClear";
import { signOut } from "@/app/login/actions";

const ROLE_LABEL = { PLATFORM_ADMIN: "Platform admin", SCHOOL_ADMIN: "School admin", COACH: "Coach", PARENT: "Parent", STUDENT: "Student" } as const;

export function navFor(user: CurrentUser): { href: string; label: string }[] {
  switch (user.role) {
    case "PLATFORM_ADMIN": return [{ href: "/admin", label: "Schools" }, { href: "/admin/questions", label: "Question bank" }, { href: "/admin/lessons", label: "Lessons" }];
    case "SCHOOL_ADMIN": return [
      { href: "/school", label: "Overview" }, { href: "/school/people", label: "People" }, { href: "/school/classes", label: "Classes" },
      { href: "/school/schedule", label: "School day" }, { href: "/school/calendar", label: "Calendar" }, { href: "/school/settings", label: "Settings" },
    ];
    case "COACH": return [{ href: "/coach", label: "My classes" }];
    case "PARENT": return [{ href: "/parent", label: "My children" }];
    case "STUDENT": return [{ href: "/student", label: "Today" }, { href: "/student/studio", label: "Studio" }, { href: `/students/${user.id}/portfolio`, label: "Portfolio" }, { href: `/students/${user.id}`, label: "My plan" }];
  }
}

export async function Shell({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  const flash = await readFlash();
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
        {children}
      </main>
    </div>
  );
}
