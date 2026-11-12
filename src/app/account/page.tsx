import { requireUser } from "@/lib/auth";
import { Shell } from "@/components/Shell";
import { PasswordForm } from "@/components/PasswordForm";
import { Info } from "@/components/Info";
import { emailConfigured } from "@/lib/email";
import { PROVIDER_LABEL, SSO_ERRORS, ssoProviders, type Provider } from "@/lib/sso";
import { disconnectProvider, setWeeklyEmail } from "./actions";

export const metadata = { title: "Account" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ sso?: string }> }) {
  const user = await requireUser();
  const err = SSO_ERRORS[(await searchParams).sso ?? ""];
  const available = ssoProviders();
  const linked: Record<Provider, boolean> = { google: !!user.googleSub, microsoft: !!user.microsoftSub };
  const providers = (["google", "microsoft"] as const).filter(p => available[p] || linked[p]);
  return (
    <Shell user={user}>
      <div><span className="eyebrow">{user.firstName} {user.lastName}</span><h1>Account</h1></div>
      {err && <p className="flash error" role="alert"><span>{err}</span></p>}
      <section className="card">
        <h2>Sign-in<Info label="Sign-in">{user.role === "STUDENT"
          ? "You sign in with your school code, username and password, or by scanning your sign-in card. Ask your coach if you forget them."
          : `You sign in with ${user.email}. If you forget your password, use Forgot your password on the sign-in page and we'll email you a link.`}</Info></h2>
        <p>{user.role === "STUDENT" ? <>Username: <b className="num">{user.username}</b> · School code: <b className="num">{user.school?.code}</b></> : <>Email: <b>{user.email}</b></>}</p>
      </section>
      {user.role !== "STUDENT" && providers.length > 0 && (
        <section className="card">
          <h2>Google and Microsoft<Info label="Connected accounts">{"Connect the Google or Microsoft account your school gave you, then use Sign in with Google or Microsoft instead of your password. Your password still works too. Google accounts with the same email connect automatically the first time you use them."}</Info></h2>
          {providers.map(p => (
            <div key={p} className="spread" style={{ alignItems: "center" }}>
              <span><b>{PROVIDER_LABEL[p]}</b> <span className={`chip ${linked[p] ? "above" : ""}`}>{linked[p] ? "Connected" : "Not connected"}</span></span>
              {linked[p]
                ? <form action={disconnectProvider}><input type="hidden" name="provider" value={p} /><button className="btn small">Disconnect</button></form>
                : available[p] && <a className="btn small" href={`/api/auth/${p}/start?link=1`}>Connect {PROVIDER_LABEL[p]}</a>}
            </div>
          ))}
        </section>
      )}
      {user.role === "PARENT" && (
        <section className="card">
          <h2>Weekly email<Info label="Weekly email">{"Every Friday afternoon: each child's days completed, streak, skills mastered, practice, project steps, open assignments and notes from their coach. One email covers all your children. Every email has a one-click link to stop them."}</Info></h2>
          <p>{user.weeklyEmail ? "On: a progress email every Friday afternoon." : "Off."}{!emailConfigured() && <span className="muted"> Your school&apos;s email sending isn&apos;t switched on yet, so nothing is sent for now.</span>}</p>
          <div className="row"><form action={setWeeklyEmail}><input type="hidden" name="on" value={user.weeklyEmail ? "false" : "true"} /><button className="btn">{user.weeklyEmail ? "Turn off weekly email" : "Turn on weekly email"}</button></form>
            <a className="btn" href="/account/weekly-preview" target="_blank" rel="noopener">Preview this week&apos;s email</a></div>
        </section>
      )}
      {user.role !== "STUDENT" && <PasswordForm />}
    </Shell>
  );
}
