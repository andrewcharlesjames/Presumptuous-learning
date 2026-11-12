"use client";
import { useActionState, useState } from "react";
import { signInAdult, signInStudent } from "./actions";

const GoogleMark = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.2C12.5 13.6 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z"/><path fill="#FBBC05" d="M10.6 28.5c-.5-1.4-.8-2.9-.8-4.5s.3-3.1.8-4.5l-7.9-6.2C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.2z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.2 1.5-5 2.3-8.2 2.3-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.2C6.6 42.6 14.6 48 24 48z"/></svg>
);
const MicrosoftMark = () => (
  <svg width="18" height="18" viewBox="0 0 23 23" aria-hidden="true"><path fill="#F35325" d="M1 1h10v10H1z"/><path fill="#81BC06" d="M12 1h10v10H12z"/><path fill="#05A6F0" d="M1 12h10v10H1z"/><path fill="#FFBA08" d="M12 12h10v10H12z"/></svg>
);

export function LoginForms({ providers = {} }: { providers?: { google?: boolean; microsoft?: boolean } }) {
  const [tab, setTab] = useState<"adult" | "student">("adult");
  const [adultState, adultAction, adultPending] = useActionState(signInAdult, undefined);
  const [studentState, studentAction, studentPending] = useActionState(signInStudent, undefined);
  return (
    <div className="card">
      <div className="tabs" role="tablist" aria-label="Who is signing in">
        <button type="button" role="tab" className="tab" aria-selected={tab === "adult"} onClick={() => setTab("adult")}>Coach, parent or admin</button>
        <button type="button" role="tab" className="tab" aria-selected={tab === "student"} onClick={() => setTab("student")}>Student</button>
      </div>
      {tab === "adult" ? (
        <form action={adultAction} className="stack">
          <label className="field">Email<input id="email" name="email" type="email" autoComplete="email" required /></label>
          <label className="field">Password<input id="password" name="password" type="password" autoComplete="current-password" required /></label>
          {adultState?.error && <p className="flash error" role="alert">{adultState.error}</p>}
          <button className="btn primary" disabled={adultPending}>{adultPending ? "Signing in…" : "Sign in"}</button>
          <a className="small" href="/forgot">Forgot your password?</a>
          {(providers.google || providers.microsoft) && (
            <div className="stack" style={{ gap: 8, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
              <span className="small muted">Or, for staff and parents whose school email is connected:</span>
              {providers.google && <a className="btn sso" href="/api/auth/google/start"><GoogleMark />Sign in with Google</a>}
              {providers.microsoft && <a className="btn sso" href="/api/auth/microsoft/start"><MicrosoftMark />Sign in with Microsoft</a>}
            </div>
          )}
        </form>
      ) : (
        <form action={studentAction} className="stack">
          <label className="field">School code<span className="hint">Your coach gives you this.</span><input id="code" name="code" type="text" autoCapitalize="characters" autoComplete="off" required /></label>
          <label className="field">Username<input id="username" name="username" type="text" autoCapitalize="none" autoComplete="username" required /></label>
          <label className="field">Password<input id="spassword" name="password" type="password" autoComplete="current-password" required /></label>
          {studentState?.error && <p className="flash error" role="alert">{studentState.error}</p>}
          <button className="btn primary" disabled={studentPending}>{studentPending ? "Signing in…" : "Sign in"}</button>
          <p className="small muted">Have a sign-in card with a QR code? Point your device&apos;s camera at it to sign in.</p>
        </form>
      )}
    </div>
  );
}
