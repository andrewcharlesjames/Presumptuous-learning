import { requireSchoolUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { BLOCK_KIND_LABEL, type BlockKindName } from "@/lib/templates";
import { resetSchedule, saveSchedule } from "../actions";

export const metadata = { title: "School day" };
const KINDS = Object.keys(BLOCK_KIND_LABEL) as BlockKindName[];

export default async function SchedulePage() {
  const { user, school } = await requireSchoolUser(["SCHOOL_ADMIN"]);
  const blocks = await db.scheduleBlock.findMany({ where: { schoolId: school.id }, orderBy: { position: "asc" } });
  const rows = [...blocks.map(b => ({ ...b, kind: b.kind as BlockKindName })), ...Array.from({ length: 3 }, (_, i) => ({ id: `new-${i}`, start: "", end: "", title: "", kind: "OTHER" as BlockKindName, focus: "" }))];
  return (
    <Shell user={user}>
      <div><span className="eyebrow">{school.name}</span><h1>School day</h1>
        <p className="muted" style={{ marginTop: 8, maxWidth: "62ch" }}>Every student&apos;s Today screen follows this timetable. Core Academics is where each student&apos;s personal plan runs. Leave a title blank to remove a block.</p></div>
      <form action={saveSchedule} className="stack">
        <div className="tablewrap"><table>
          <thead><tr><th>Start</th><th>End</th><th>Block</th><th>Type</th><th>Focus</th></tr></thead>
          <tbody>{rows.map((b, i) => (
            <tr key={b.id}>
              <td><input aria-label="Start" id={`start-${i}`} name="start" type="time" defaultValue={b.start} /></td>
              <td><input aria-label="End" id={`end-${i}`} name="end" type="time" defaultValue={b.end} /></td>
              <td><input aria-label="Block title" id={`title-${i}`} name="title" type="text" defaultValue={b.title} placeholder={i >= blocks.length ? "New block" : ""} /></td>
              <td><select aria-label="Type" id={`kind-${i}`} name="kind" defaultValue={b.kind}>{KINDS.map(k => <option key={k} value={k}>{BLOCK_KIND_LABEL[k]}</option>)}</select></td>
              <td><input aria-label="Focus" id={`focus-${i}`} name="focus" type="text" defaultValue={b.focus} /></td>
            </tr>
          ))}</tbody>
        </table></div>
        <div className="row"><button className="btn primary">Save school day</button></div>
      </form>
      <form action={resetSchedule}><button className="btn small">Restore the default day</button></form>
    </Shell>
  );
}
