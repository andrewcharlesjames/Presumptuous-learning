import { Info } from "@/components/Info";
import Link from "next/link";
import { fmtClock } from "@/lib/dates";
import { requireSchoolUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { BLOCK_KIND_LABEL, DAY_PATTERNS, EVERY_DAY, daysLabel, type BlockKindName } from "@/lib/templates";
import { resetSchedule, saveSchedule } from "../actions";

export const metadata = { title: "School day" };
const KINDS = Object.keys(BLOCK_KIND_LABEL) as BlockKindName[];

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { user, school } = await requireSchoolUser(["SCHOOL_ADMIN", "COACH"]);
  const canEdit = user.role === "SCHOOL_ADMIN";
  const editing = canEdit && (await searchParams).edit === "1";
  const blocks = await db.scheduleBlock.findMany({ where: { schoolId: school.id }, orderBy: { position: "asc" } });
  const rows = [...blocks.map(b => ({ ...b, kind: b.kind as BlockKindName })), ...Array.from({ length: 3 }, (_, i) => ({ id: `new-${i}`, start: "", end: "", title: "", kind: "OTHER" as BlockKindName, focus: "", days: EVERY_DAY }))];
  if (!editing) {
    const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    return (
      <Shell user={user}>
        <div className="spread">
          <div><span className="eyebrow">{school.name}</span><h1>School day<Info label="School day">{canEdit
            ? "The timetable every student's Today page follows: Assembly holds the check-in, Academics their lessons, Arts the studio prompt, the Presumptuous Project its business lessons and project work, Reflection the end of the day. It's locked so nothing changes by accident. Click Edit school day to change it."
            : "Your school's timetable, set by the school admin. Every student's Today page follows it. Ask your school admin if something needs to change."}</Info></h1>
            <p className="muted small" style={{ marginTop: 6 }}>{canEdit ? "Locked. Every student's Today page follows this timetable." : "Set by your school admin."}</p></div>
          {canEdit && <Link className="btn" href="/school/schedule?edit=1">Edit school day</Link>}
        </div>
        <div className="weekgrid">
          {DAYS.map((d, i) => {
            const today = blocks.filter(b => b.days.includes(i)).sort((a, b) => a.start.localeCompare(b.start));
            return (
              <div key={d} className="weekday">
                <h3><span>{d}</span></h3>
                {today.map(b => (
                  <div key={b.id} className={`mini ${b.kind === "LIFE_SKILLS" ? "ent" : b.kind === "ACADEMICS" ? "" : b.kind === "ARTS" ? "step" : "assign"}`}>
                    <span className="small muted">{fmtClock(b.start)}–{fmtClock(b.end)}</span>
                    <b>{b.title}</b>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </Shell>
    );
  }

  return (
    <Shell user={user}>
      <div><span className="eyebrow">{school.name}</span><h1>School day<Info label="Editing the school day">{"Your bell schedule. Every student's Today page follows it: Assembly holds the check-in, Academics holds their plan, Arts the studio prompt, the Presumptuous Project its business lessons and project work, Reflection the end-of-day reflection. Use Days for blocks that only run on some weekdays: the default gives the Presumptuous Project 2 hours on Monday, Wednesday and Friday and Arts 2 hours on Tuesday and Thursday. Blocks can't overlap on the same day."}</Info></h1>
        <p className="muted" style={{ marginTop: 8, maxWidth: "62ch" }}>Every student&apos;s Today screen follows this timetable. Core Academics is where each student&apos;s personal plan runs. Leave a title blank to remove a block.</p></div>
      <form action={saveSchedule} className="stack">
        <div className="tablewrap"><table>
          <thead><tr><th>Start</th><th>End</th><th>Days</th><th>Block</th><th>Type</th><th>Focus</th></tr></thead>
          <tbody>{rows.map((b, i) => (
            <tr key={b.id}>
              <td><input aria-label="Start" id={`start-${i}`} name="start" type="time" defaultValue={b.start} /></td>
              <td><input aria-label="End" id={`end-${i}`} name="end" type="time" defaultValue={b.end} /></td>
              <td><select aria-label="Days" id={`days-${i}`} name="days" defaultValue={[...b.days].sort().join(",")}>
                {[...DAY_PATTERNS, ...(DAY_PATTERNS.some(p => p.days.join() === [...b.days].sort().join()) ? [] : [{ label: daysLabel(b.days), days: [...b.days].sort() }])].map(p => <option key={p.days.join()} value={p.days.join(",")}>{p.label}</option>)}
              </select></td>
              <td><input aria-label="Block title" id={`title-${i}`} name="title" type="text" defaultValue={b.title} placeholder={i >= blocks.length ? "New block" : ""} /></td>
              <td><select aria-label="Type" id={`kind-${i}`} name="kind" defaultValue={b.kind}>{KINDS.map(k => <option key={k} value={k}>{BLOCK_KIND_LABEL[k]}</option>)}</select></td>
              <td><input aria-label="Focus" id={`focus-${i}`} name="focus" type="text" defaultValue={b.focus} /></td>
            </tr>
          ))}</tbody>
        </table></div>
        <div className="row"><button className="btn primary">Save school day</button><Link className="btn" href="/school/schedule">Cancel</Link></div>
      </form>
      <form action={resetSchedule}><button className="btn small">Restore the default day</button></form>
    </Shell>
  );
}
