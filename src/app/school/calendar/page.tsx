import { Info } from "@/components/Info";
import { requireSchoolUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { CALENDAR_KIND_LABEL, type CalendarKindName } from "@/lib/templates";
import { fmtDate, isoDate, schoolYearOf } from "@/lib/dates";
import { addEvent, applyOntarioTemplate, deleteEvent, saveYear } from "../actions";

export const metadata = { title: "Calendar" };
const KINDS = Object.keys(CALENDAR_KIND_LABEL) as CalendarKindName[];

export default async function CalendarPage() {
  const { user, school } = await requireSchoolUser(["SCHOOL_ADMIN"]);
  const events = await db.calendarEvent.findMany({ where: { schoolId: school.id }, orderBy: { startDate: "asc" } });
  const y = schoolYearOf(school.yearStart);
  const fmt = (d: Date) => fmtDate(d, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  return (
    <Shell user={user}>
      <div><span className="eyebrow">{school.name}</span><h1>School calendar<Info label="Calendar">{"The school year's first and last days, holidays, breaks and PA days. Holidays, breaks, PA days and anything marked no school aren't school days: streaks skip them and students see the reason on their Today page."}</Info></h1>
        <p className="muted" style={{ marginTop: 8, maxWidth: "62ch" }}>Days marked “no school” are skipped by plans and attendance. Year plans and report-card milestones come from this calendar.</p></div>
      <form action={saveYear} className="card">
        <h2>School year</h2>
        <div className="form-grid">
          <label className="field">First day<input id="yearStart" name="yearStart" type="date" defaultValue={isoDate(school.yearStart)} required /></label>
          <label className="field">Last day<input id="yearEnd" name="yearEnd" type="date" defaultValue={isoDate(school.yearEnd)} required /></label>
          <div><button className="btn primary">Save dates</button></div>
        </div>
      </form>
      <section className="stack">
        <h2>Holidays, breaks and events</h2>
        {events.length ? (
          <div className="tablewrap"><table>
            <thead><tr><th>Date</th><th>Event</th><th>Type</th><th>School?</th><th></th></tr></thead>
            <tbody>{events.map(e => (
              <tr key={e.id}>
                <td className="num small">{fmt(e.startDate)}{e.endDate > e.startDate && <> – {fmt(e.endDate)}</>}</td>
                <td><b>{e.title}</b></td>
                <td className="small">{CALENDAR_KIND_LABEL[e.kind as CalendarKindName]}</td>
                <td className="small">{e.noSchool ? <span className="pill below">No school</span> : <span className="muted">Open</span>}</td>
                <td><form action={deleteEvent}><input type="hidden" name="id" value={e.id} /><button className="btn small">Remove</button></form></td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <p className="muted">No events yet.</p>}
        <form action={addEvent} className="card">
          <h3>Add a date<Info label="Adding a date">{"Add a single day or a range (like March Break). Tick no school for days students aren't in."}</Info></h3>
          <div className="form-grid">
            <label className="field">Title<input id="ev-title" name="title" type="text" placeholder="e.g. PA day" required /></label>
            <label className="field">Type<select id="ev-kind" name="kind" defaultValue="PA_DAY">{KINDS.map(k => <option key={k} value={k}>{CALENDAR_KIND_LABEL[k]}</option>)}</select></label>
            <label className="field">Start<input id="ev-start" name="startDate" type="date" required /></label>
            <label className="field">End<span className="hint">Leave blank for one day.</span><input id="ev-end" name="endDate" type="date" /></label>
          </div>
          <label className="check"><input type="checkbox" name="noSchool" id="ev-noschool" />No school on these days (holidays, breaks and PA days are always no school)</label>
          <div><button className="btn primary">Add</button></div>
        </form>
      </section>
      <form action={applyOntarioTemplate} className="card tight">
        <input type="hidden" name="year" value={y} />
        <div className="spread">
          <p className="small muted" style={{ maxWidth: "60ch" }}>Load a typical Ontario {y}–{String(y + 1).slice(2)} calendar: Labour Day, Thanksgiving, winter break, Family Day, March break, Easter, Victoria Day and report cards. It replaces events inside the school year. Your board&apos;s PA days still need adding.</p>
          <button className="btn small">Load Ontario template</button>
        </div>
      </form>
    </Shell>
  );
}
