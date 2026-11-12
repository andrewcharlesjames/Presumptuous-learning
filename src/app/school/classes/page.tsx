import Link from "next/link";
import { requireSchoolUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { gradeName, gradeShort, plural } from "@/lib/subjects";
import { createClass } from "../actions";

export const metadata = { title: "Classes" };

export default async function ClassesPage() {
  const { user, school } = await requireSchoolUser(["SCHOOL_ADMIN"]);
  const classes = await db.class.findMany({
    where: { schoolId: school.id }, orderBy: { name: "asc" },
    include: { coaches: { include: { coach: true } }, _count: { select: { students: true } } },
  });
  return (
    <Shell user={user}>
      <div><span className="eyebrow">{school.name}</span><h1>Classes</h1></div>
      {classes.length ? (
        <div className="tablewrap"><table>
          <thead><tr><th>Class</th><th>Grades</th><th>{plural(school.coachTitle)}</th><th>Students</th></tr></thead>
          <tbody>{classes.map(c => (
            <tr key={c.id}>
              <td><Link href={`/school/classes/${c.id}`}>{c.name}</Link></td>
              <td className="num">{c.grades.length ? c.grades.map(gradeShort).join(", ") : <span className="muted">Any</span>}</td>
              <td className="small">{c.coaches.map(x => `${x.coach.firstName} ${x.coach.lastName}`).join(", ") || <span className="muted">None</span>}</td>
              <td className="num">{c._count.students}</td>
            </tr>
          ))}</tbody>
        </table></div>
      ) : <div className="empty"><b>No classes yet</b><span>A class groups students with their {school.coachTitle.toLowerCase()}. Combined grades are fine, for example Grades 1 and 2 together.</span></div>}
      <form action={createClass} className="card">
        <h2>Create a class</h2>
        <label className="field">Name<input id="c-name" name="name" type="text" placeholder="e.g. Junior Studio A" required /></label>
        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontWeight: 600, marginBottom: 6 }}>Grades</legend>
          <div className="row">{Array.from({ length: 13 }, (_, g) => (
            <label key={g} className="check"><input type="checkbox" name="grades" value={g} id={`g-${g}`} />{gradeName(g).replace("Grade ", "Gr ")}</label>
          ))}</div>
        </fieldset>
        <div><button className="btn primary">Create class</button></div>
      </form>
    </Shell>
  );
}
