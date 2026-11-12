import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSchoolUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { gradeShort, plural } from "@/lib/subjects";
import { deleteClass, saveClassMembers } from "../../actions";

export default async function ClassEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, school } = await requireSchoolUser(["SCHOOL_ADMIN"]);
  const cls = await db.class.findFirst({ where: { id, schoolId: school.id }, include: { coaches: true, students: true } });
  if (!cls) notFound();
  const [staff, students] = await Promise.all([
    db.user.findMany({ where: { schoolId: school.id, role: { in: ["COACH", "SCHOOL_ADMIN"] }, active: true }, orderBy: { lastName: "asc" } }),
    db.user.findMany({ where: { schoolId: school.id, role: "STUDENT", active: true }, orderBy: [{ grade: "asc" }, { lastName: "asc" }] }),
  ]);
  const coachSet = new Set(cls.coaches.map(c => c.coachId)), studentSet = new Set(cls.students.map(s => s.studentId));
  const suggested = students.filter(s => cls.grades.includes(s.grade ?? -1));
  const others = students.filter(s => !cls.grades.includes(s.grade ?? -1));
  const box = (s: typeof students[number]) => (
    <label key={s.id} className="check"><input type="checkbox" name="student" value={s.id} id={`st-${s.id}`} defaultChecked={studentSet.has(s.id)} />{s.firstName} {s.lastName} <span className="muted small">Gr {gradeShort(s.grade ?? 0)}</span></label>
  );
  return (
    <Shell user={user}>
      <div className="spread">
        <div><Link href="/school/classes" className="small">← Classes</Link><h1>{cls.name}</h1></div>
        <Link className="btn" href={`/coach/classes/${cls.id}`}>Open class view</Link>
      </div>
      <form action={saveClassMembers} className="stack">
        <input type="hidden" name="id" value={cls.id} />
        <div className="card">
          <label className="field">Class name<input id="name" name="name" type="text" defaultValue={cls.name} /></label>
          <h3>{plural(school.coachTitle)}</h3>
          {staff.length ? <div className="grid3">{staff.map(c => (
            <label key={c.id} className="check"><input type="checkbox" name="coach" value={c.id} id={`co-${c.id}`} defaultChecked={coachSet.has(c.id)} />{c.firstName} {c.lastName}{c.role === "SCHOOL_ADMIN" && <span className="muted small">admin</span>}</label>
          ))}</div> : <p className="muted">Add {plural(school.coachTitle).toLowerCase()} on the People page first.</p>}
        </div>
        <div className="card">
          <h3>Students</h3>
          {suggested.length > 0 && <><span className="eyebrow">In this class&apos;s grades</span><div className="grid3">{suggested.map(box)}</div></>}
          {others.length > 0 && <><span className="eyebrow">Other grades</span><div className="grid3">{others.map(box)}</div></>}
          {!students.length && <p className="muted">Add students on the People page first.</p>}
        </div>
        <div className="row"><button className="btn primary">Save class</button></div>
      </form>
      <form action={deleteClass}><input type="hidden" name="id" value={cls.id} /><button className="btn small danger">Delete this class</button></form>
    </Shell>
  );
}
