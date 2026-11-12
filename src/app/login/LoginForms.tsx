"use client";
import { useActionState, useState } from "react";
import { signInAdult, signInStudent } from "./actions";

export function LoginForms() {
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
        </form>
      ) : (
        <form action={studentAction} className="stack">
          <label className="field">School code<span className="hint">Your coach gives you this.</span><input id="code" name="code" type="text" autoCapitalize="characters" autoComplete="off" required /></label>
          <label className="field">Username<input id="username" name="username" type="text" autoCapitalize="none" autoComplete="username" required /></label>
          <label className="field">Password<input id="spassword" name="password" type="password" autoComplete="current-password" required /></label>
          {studentState?.error && <p className="flash error" role="alert">{studentState.error}</p>}
          <button className="btn primary" disabled={studentPending}>{studentPending ? "Signing in…" : "Sign in"}</button>
        </form>
      )}
    </div>
  );
}
