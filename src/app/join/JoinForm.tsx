"use client";
import { useActionState } from "react";
import { joinAsParent } from "../login/actions";

export function JoinForm() {
  const [state, action, pending] = useActionState(joinAsParent, undefined);
  return (
    <form action={action} className="card stack">
      <label className="field">Family code<span className="hint">From your child&apos;s school, like ABCD-2345.</span>
        <input id="code" name="code" type="text" autoCapitalize="characters" autoComplete="off" required /></label>
      <div className="grid2">
        <label className="field">First name<input id="firstName" name="firstName" type="text" autoComplete="given-name" required /></label>
        <label className="field">Last name<input id="lastName" name="lastName" type="text" autoComplete="family-name" required /></label>
      </div>
      <label className="field">Email<input id="email" name="email" type="email" autoComplete="email" required /></label>
      <label className="field">Password<span className="hint">At least 10 characters.</span><input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required /></label>
      {state?.error && <p className="flash error" role="alert">{state.error}</p>}
      <button className="btn primary" disabled={pending}>{pending ? "Creating account…" : "Create parent account"}</button>
    </form>
  );
}
