import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Info } from "@/components/Info";
import { ForgotForm } from "./ForgotForm";

export const metadata = { title: "Forgot your password" };

export default function ForgotPage() {
  return (
    <div className="wrap">
      <header className="topbar"><Logo /></header>
      <main className="authbox stack">
        <h1>Forgot your password?<Info label="Resetting a password">{"For parents, coaches and admins who sign in with email. We email a link that works once, for 60 minutes. Using it signs you out on every other device. Students: ask your coach to reset your password or print you a sign-in card."}</Info></h1>
        <p className="muted">Enter the email you sign in with and we&apos;ll send you a link to choose a new password.</p>
        <ForgotForm />
        <p className="small"><Link href="/login">Back to sign in</Link></p>
      </main>
    </div>
  );
}
