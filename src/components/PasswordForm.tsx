"use client";
import { Info } from "@/components/Info";
import { useActionState } from "react";
import { changePassword } from "@/app/login/actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);
  return (
    <form action={action} className="card">
      <h2>Change your password<Info label="Passwords">{"Use at least 10 characters, and don't reuse a password from another site. You'll need your current password to change it."}</Info></h2>
      <div className="form-grid">
        <label className="field">Current password<input id="current" name="current" type="password" autoComplete="current-password" required /></label>
        <label className="field">New password<span className="hint">At least 10 characters.</span><input id="next" name="next" type="password" autoComplete="new-password" minLength={10} required /></label>
        <div><button className="btn" disabled={pending}>Change password</button></div>
      </div>
      {state?.error && <p className="flash error" role="alert">{state.error}</p>}
    </form>
  );
}
