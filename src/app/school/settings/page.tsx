import { Info } from "@/components/Info";
import { requireSchoolUser } from "@/lib/auth";
import { Shell } from "@/components/Shell";
import { PasswordForm } from "@/components/PasswordForm";
import { saveSettings } from "../actions";
import { isoDate, schoolYearOf } from "@/lib/dates";
import { defaultLaunchDay } from "@/lib/projects";
import { DAILY_LIMIT, tutorConfigured } from "@/lib/tutor";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { user, school } = await requireSchoolUser(["SCHOOL_ADMIN"]);
  return (
    <Shell user={user}>
      <div><span className="eyebrow">{school.name}</span><h1>Settings<Info label="Settings">{"School-wide choices: name, what staff are called, time zone, Launch Day, and the AI features. Changes apply to everyone at once."}</Info></h1></div>
      <form action={saveSettings} className="card">
        <h2>School</h2>
        <div className="form-grid">
          <label className="field">School name<input id="name" name="name" type="text" defaultValue={school.name} required /></label>
          <label className="field">Title for staff who work with students<span className="hint">Shown everywhere. Default: Coach.</span><input id="coachTitle" name="coachTitle" type="text" defaultValue={school.coachTitle} required /></label>
          <label className="field">Time zone<input id="timezone" name="timezone" type="text" defaultValue={school.timezone} required /></label>
        </div>
        <label className="field" style={{ maxWidth: 260 }}>Launch Day<span className="hint">When students launch and present their projects. Default: third Thursday of May.</span>
          <input id="launchDay" name="launchDay" type="date" defaultValue={isoDate(school.launchDay ?? defaultLaunchDay(schoolYearOf(school.yearStart)))} /></label>
        <label className="check"><input type="checkbox" name="aiTutor" id="aiTutor" defaultChecked={school.aiTutor} />Turn on the AI tutor for students</label>
        <p className="small muted" style={{ marginTop: -6 }}>After a wrong practice answer, students can ask for a short explanation written by AI (Claude, by Anthropic). Only the question, its answer choices, the student&apos;s choice and grade are sent; never names or other personal information. Up to {DAILY_LIMIT} explanations per student per day.{!tutorConfigured() && " The platform hasn't been connected to the AI service yet, so this has no effect until it is."}</p>
        <label className="check"><input type="checkbox" name="aiNeedsConsent" id="aiNeedsConsent" defaultChecked={school.aiNeedsConsent} />Require a parent&apos;s consent before a student uses AI features</label>
        <p className="small muted" style={{ marginTop: -6 }}>Covers the AI tutor and project idea suggestions, which send a student&apos;s answers or writing to the AI service. Lessons are written once per skill from no student information and aren&apos;t affected. Parents give consent on their dashboard; you can record paper consent on a student&apos;s page.</p>
        <p className="small muted">School code for student sign-in: <b className="num">{school.code}</b></p>
        <div><button className="btn primary">Save settings</button></div>
      </form>
      <PasswordForm />
    </Shell>
  );
}
