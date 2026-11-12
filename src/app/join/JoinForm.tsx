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
      <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0, gap: 8 }}>
        <legend className="small" style={{ fontWeight: 600, marginBottom: 6 }}>Consent (you can change these any time from your dashboard)</legend>
        <label className="check small"><input type="checkbox" name="consentPlatform" id="consentPlatform" defaultChecked />I consent to my child&apos;s school using Presumptuous Learning to store and use my child&apos;s learning records.</label>
        <label className="check small"><input type="checkbox" name="consentAi" id="consentAi" />I consent to AI features (the AI tutor and project ideas), which send my child&apos;s answers, never their name, to Anthropic&apos;s Claude AI.</label>
        <span className="small muted">Read the <a href="/privacy" target="_blank">privacy notice</a>.</span>
      </fieldset>
      {state?.error && <p className="flash error" role="alert">{state.error}</p>}
      <button className="btn primary" disabled={pending}>{pending ? "Creating account…" : "Create parent account"}</button>
    </form>
  );
}
