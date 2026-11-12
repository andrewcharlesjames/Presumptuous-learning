import { Info } from "@/components/Info";
import Link from "next/link";
import { requireSchoolUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { SubjectChips } from "@/components/Status";
import { latestResults } from "@/lib/records";
import { gradeName, gradeShort, plural } from "@/lib/subjects";
import { addStaff, addStudent, importStudents, resetPassword, setActive } from "../actions";

export const metadata = { title: "People" };
const GRADES = Array.from({ length: 13 }, (_, g) => g);

export default async function PeoplePage() {
  const { user, school } = await requireSchoolUser(["SCHOOL_ADMIN"]);
  const [students, staff, parents, classes] = await Promise.all([
    db.user.findMany({ where: { schoolId: school.id, role: "STUDENT" }, orderBy: [{ grade: "asc" }, { lastName: "asc" }], include: { studentIn: { include: { class: true } }, parents: true } }),
    db.user.findMany({ where: { schoolId: school.id, role: { in: ["COACH", "SCHOOL_ADMIN"] } }, orderBy: [{ role: "asc" }, { lastName: "asc" }], include: { coachOf: { include: { class: true } } } }),
    db.user.findMany({ where: { schoolId: school.id, role: "PARENT" }, orderBy: { lastName: "asc" }, include: { children: { include: { student: true } } } }),
    db.class.findMany({ where: { schoolId: school.id }, orderBy: { name: "asc" } }),
  ]);
  const latest = await latestResults(students.map(s => s.id));
  const coachT = school.coachTitle;

  return (
    <Shell user={user}>
      <div><span className="eyebrow">{school.name}</span><h1>People</h1></div>

      <section className="stack">
        <div className="spread"><h2>Students <span className="muted num">({students.length})</span></h2></div>
        {students.length ? (
          <div className="tablewrap"><table>
            <thead><tr><th>Name</th><th>Grade</th><th>Username</th><th>Class</th><th>Placement</th><th>Family code</th><th></th></tr></thead>
            <tbody>{students.map(s => {
              const l = latest.get(s.id);
              return (
                <tr key={s.id} style={s.active ? undefined : { opacity: .5 }}>
                  <td><Link href={`/students/${s.id}`}>{s.firstName} {s.lastName}</Link>{s.parents.length > 0 && <span className="small muted"> · {s.parents.length} parent{s.parents.length > 1 ? "s" : ""}</span>}</td>
                  <td className="num">{gradeShort(s.grade ?? 0)}</td>
                  <td className="num">{s.username}</td>
                  <td className="small">{s.studentIn.map(c => c.class.name).join(", ") || <span className="muted">None</span>}</td>
                  <td>{l ? <SubjectChips results={l.results} grade={l.grade} /> : <span className="small muted">Not assessed</span>}</td>
                  <td className="num small">{s.familyCode}</td>
                  <td><div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                    <form action={resetPassword}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="returnTo" value="/school/people" /><button className="btn small">New password</button></form>
                    <form action={setActive}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="active" value={String(!s.active)} /><button className="btn small">{s.active ? "Deactivate" : "Reactivate"}</button></form>
                  </div></td>
                </tr>
              );
            })}</tbody>
          </table></div>
        ) : <div className="empty"><b>No students yet</b><span>Add one at a time below, or import a class list.</span></div>}

        <div className="grid2">
          <form action={addStudent} className="card">
            <h3>Add a student<Info label="Adding a student">{"You'll get their username, an easy password and a family code to send home. Students sign in with the school code, username and password. Each active student uses a licence seat."}</Info></h3>
            <div className="grid2">
              <label className="field">First name<input id="s-first" name="firstName" type="text" required /></label>
              <label className="field">Last name<input id="s-last" name="lastName" type="text" required /></label>
            </div>
            <div className="grid2">
              <label className="field">Grade<select id="s-grade" name="grade" defaultValue="" required><option value="" disabled>Choose</option>{GRADES.map(g => <option key={g} value={g}>{gradeName(g)}</option>)}</select></label>
              <label className="field">Class<select id="s-class" name="classId" defaultValue=""><option value="">None yet</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            </div>
            <label className="field">Username<span className="hint">Optional. We'll make one like amira.k.</span><input id="s-username" name="username" type="text" autoCapitalize="none" /></label>
            <div><button className="btn primary">Add student</button></div>
            <p className="small muted">You&apos;ll see the student&apos;s password and their family code for parents once.</p>
          </form>
          <form action={importStudents} className="card">
            <h3>Import a class list<Info label="Importing">{"Paste a CSV with columns first_name, last_name, grade (K or 0 to 12), and optionally username and class. Rows with mistakes are skipped and listed. New usernames, passwords and family codes are shown once, straight after, so copy them then."}</Info></h3>
            <p className="small muted">Paste from a spreadsheet saved as CSV. Required columns: first_name, last_name, grade (K or 1–12). Optional: username, class (must match a class name).</p>
            <label className="field">CSV<textarea id="csv" name="csv" placeholder={"first_name,last_name,grade,class\nAmira,Khan,3,Junior Studio A\nLiam,Tremblay,K,"} /></label>
            <div><button className="btn">Import students</button></div>
          </form>
        </div>
      </section>

      <section className="stack">
        <h2>{plural(coachT)} and admins <span className="muted num">({staff.length})</span></h2>
        <div className="tablewrap"><table>
          <thead><tr><th>Name</th><th>Role</th><th>Email</th><th>Classes</th><th></th></tr></thead>
          <tbody>{staff.map(s => (
            <tr key={s.id} style={s.active ? undefined : { opacity: .5 }}>
              <td><b>{s.firstName} {s.lastName}</b></td>
              <td>{s.role === "COACH" ? coachT : "School admin"}</td>
              <td className="small">{s.email}</td>
              <td className="small">{s.coachOf.map(c => c.class.name).join(", ") || <span className="muted">None</span>}</td>
              <td>{s.id !== user.id && <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                <form action={resetPassword}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="returnTo" value="/school/people" /><button className="btn small">New password</button></form>
                <form action={setActive}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="active" value={String(!s.active)} /><button className="btn small">{s.active ? "Deactivate" : "Reactivate"}</button></form>
              </div>}</td>
            </tr>
          ))}</tbody>
        </table></div>
        <form action={addStaff} className="card">
          <h3>Add a {coachT.toLowerCase()} or admin<Info label="Adding staff">{"Coaches see their own classes; school admins see everything at this school. They sign in with email and the temporary password shown once."}</Info></h3>
          <div className="form-grid">
            <label className="field">First name<input id="t-first" name="firstName" type="text" required /></label>
            <label className="field">Last name<input id="t-last" name="lastName" type="text" required /></label>
            <label className="field">Email<input id="t-email" name="email" type="email" required /></label>
            <label className="field">Role<select id="t-role" name="role" defaultValue="COACH"><option value="COACH">{coachT}</option><option value="SCHOOL_ADMIN">School admin</option></select></label>
          </div>
          <div><button className="btn primary">Add</button></div>
        </form>
      </section>

      <section className="stack">
        <h2>Parents <span className="muted num">({parents.length})</span><Info label="Parents">{"Parents create their own accounts with a child's family code at the join page. They only see their own children."}</Info></h2>
        <p className="muted small">Parents create their own accounts at <b>/join</b> using a student&apos;s family code (shown in the students table). One parent can link several children.</p>
        {parents.length ? (
          <div className="tablewrap"><table>
            <thead><tr><th>Name</th><th>Email</th><th>Children</th><th></th></tr></thead>
            <tbody>{parents.map(p => (
              <tr key={p.id} style={p.active ? undefined : { opacity: .5 }}>
                <td><b>{p.firstName} {p.lastName}</b></td><td className="small">{p.email}</td>
                <td className="small">{p.children.map(c => `${c.student.firstName} ${c.student.lastName}`).join(", ")}</td>
                <td><form action={setActive}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="active" value={String(!p.active)} /><button className="btn small">{p.active ? "Deactivate" : "Reactivate"}</button></form></td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <p className="muted">No parents have joined yet.</p>}
      </section>
    </Shell>
  );
}
