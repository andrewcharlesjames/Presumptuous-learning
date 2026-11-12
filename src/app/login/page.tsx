import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { getUser, homeFor } from "@/lib/auth";
import { LoginForms } from "./LoginForms";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const user = await getUser();
  if (user) redirect(homeFor(user.role));
  return (
    <div className="wrap">
      <header className="topbar"><Logo /></header>
      <main className="authbox stack">
        <h1>Sign in</h1>
        <LoginForms />
        <p className="small muted">Parent with a family code from your child&apos;s school? <Link href="/join">Create your parent account</Link>.</p>
      </main>
      <footer className="small muted" style={{ marginTop: 40, paddingTop: 16, borderTop: "1px solid var(--line)" }}><Link href="/privacy" style={{ color: "inherit" }}>Privacy notice</Link></footer>
    </div>
  );
}
