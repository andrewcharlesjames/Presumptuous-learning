import { Info } from "@/components/Info";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { getUser, homeFor } from "@/lib/auth";
import { LoginForms } from "./LoginForms";
import { SSO_ERRORS, ssoProviders } from "@/lib/sso";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ sso?: string; card?: string }> }) {
  const user = await getUser();
  if (user) redirect(homeFor(user.role));
  const sp = await searchParams;
  const ssoError = SSO_ERRORS[sp.sso ?? ""] ?? (sp.card === "old" ? "That sign-in card doesn't work any more. Ask your coach for a new one, or type your school code and username." : sp.card === "busy" ? "Too many tries. Wait a few minutes or ask your coach." : undefined);
  return (
    <div className="wrap">
      <header className="topbar"><Logo /></header>
      <main className="authbox stack">
        <h1>Sign in<Info label="Signing in">{"Students: choose Student and type your school code, username and password (your coach or the office has them). Parents, coaches and admins: use your email and password. New parent? Use Parents: join with the family code from the school. Forgot your password? Adults: use Forgot your password to get an email link. Students: ask your coach. Staff and parents can also use Sign in with Google or Microsoft once it is connected."}</Info></h1>
        {ssoError && <p className="flash error" role="alert"><span>{ssoError}</span></p>}
        <LoginForms providers={ssoProviders()} />
        <p className="small muted">Parent with a family code from your child&apos;s school? <Link href="/join">Create your parent account</Link>.</p>
      </main>
      <footer className="small muted" style={{ marginTop: 40, paddingTop: 16, borderTop: "1px solid var(--line)" }}><Link href="/privacy" style={{ color: "inherit" }}>Privacy notice</Link></footer>
    </div>
  );
}
