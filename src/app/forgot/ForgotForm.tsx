"use client";
import { useActionState } from "react";
import { requestReset, resetPassword } from "./actions";

export function ForgotForm() {
  const [state, action, pending] = useActionState(requestReset, undefined);
  if (state?.sent) return (
    <div className="flash ok" role="status"><span>If that email has an account, a reset link is on its way. It works for 60 minutes. Check your junk folder too.</span></div>
  );
  return (
    <form action={action} className="card stack">
      <label className="field">Email<input id="email" name="email" type="email" autoComplete="email" required /></label>
      {state?.error && <p className="flash error" role="alert">{state.error}</p>}
      <button className="btn primary" disabled={pending}>{pending ? "Sending…" : "Email me a reset link"}</button>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword, undefined);
  return (
    <form action={action} className="card stack">
      <input type="hidden" name="token" value={token} />
      <label className="field">New password<span className="hint">At least 10 characters.</span><input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required /></label>
      <label className="field">Type it again<input id="confirm" name="confirm" type="password" autoComplete="new-password" required /></label>
      {state?.error && <p className="flash error" role="alert">{state.error}</p>}
      <button className="btn primary" disabled={pending}>{pending ? "Saving…" : "Save and sign in"}</button>
    </form>
  );
}
