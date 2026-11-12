import { Info } from "@/components/Info";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { JoinForm } from "./JoinForm";

export const metadata = { title: "Parent sign-up" };

export default function JoinPage() {
  return (
    <div className="wrap">
      <header className="topbar"><Logo /></header>
      <main className="authbox stack">
        <h1>Create your parent account<Info label="Joining">{"Your child's school gives you a family code. It links your account to your child so you can see their plan and progress. You can add more children later with their codes."}</Info></h1>
        <p className="muted">You&apos;ll see your child&apos;s placement, daily plan and attendance. Have more than one child? Add the others from your dashboard after signing up.</p>
        <JoinForm />
        <p className="small muted">Already have an account? <Link href="/login">Sign in</Link>.</p>
      </main>
      <footer className="small muted" style={{ marginTop: 40, paddingTop: 16, borderTop: "1px solid var(--line)" }}><Link href="/privacy" style={{ color: "inherit" }}>Privacy notice</Link></footer>
    </div>
  );
}
