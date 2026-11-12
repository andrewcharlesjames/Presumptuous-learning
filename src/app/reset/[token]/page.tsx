import Link from "next/link";
import { Logo } from "@/components/Logo";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/passwords";
import { ResetForm } from "../../forgot/ForgotForm";

export const metadata = { title: "Choose a new password" };

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const reset = await db.passwordReset.findUnique({ where: { tokenHash: sha256(token) }, include: { user: { select: { firstName: true, active: true } } } });
  const valid = reset && !reset.usedAt && reset.expiresAt > new Date() && reset.user.active;
  return (
    <div className="wrap">
      <header className="topbar"><Logo /></header>
      <main className="authbox stack">
        <h1>{valid ? `Choose a new password, ${reset.user.firstName}` : "This link has expired"}</h1>
        {valid ? <ResetForm token={token} /> : (
          <div className="stack">
            <p className="muted">Reset links work once, for 60 minutes.</p>
            <p><Link className="btn primary" href="/forgot">Send me a new link</Link></p>
          </div>
        )}
      </main>
    </div>
  );
}
