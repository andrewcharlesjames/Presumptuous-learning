import { requireSchoolUser } from "@/lib/auth";
import { Shell } from "@/components/Shell";
import { PasswordForm } from "@/components/PasswordForm";
import { saveSettings } from "../actions";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { user, school } = await requireSchoolUser(["SCHOOL_ADMIN"]);
  return (
    <Shell user={user}>
      <div><span className="eyebrow">{school.name}</span><h1>Settings</h1></div>
      <form action={saveSettings} className="card">
        <h2>School</h2>
        <div className="form-grid">
          <label className="field">School name<input id="name" name="name" type="text" defaultValue={school.name} required /></label>
          <label className="field">Title for staff who work with students<span className="hint">Shown everywhere. Default: Coach.</span><input id="coachTitle" name="coachTitle" type="text" defaultValue={school.coachTitle} required /></label>
          <label className="field">Time zone<input id="timezone" name="timezone" type="text" defaultValue={school.timezone} required /></label>
        </div>
        <p className="small muted">School code for student sign-in: <b className="num">{school.code}</b></p>
        <div><button className="btn primary">Save settings</button></div>
      </form>
      <PasswordForm />
    </Shell>
  );
}
