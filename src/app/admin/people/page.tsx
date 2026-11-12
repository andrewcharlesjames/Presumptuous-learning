import Link from "next/link";
import type { Prisma, Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { Info } from "@/components/Info";
import { fmtStamp } from "@/lib/dates";
import { gradeShort } from "@/lib/subjects";
import { adminSendResetLink, adminSetActive, adminTempPassword } from "../actions";

export const metadata = { title: "People" };
const ROLE: Record<Role, string> = { PLATFORM_ADMIN: "Platform admin", SCHOOL_ADMIN: "School admin", COACH: "Coach", PARENT: "Parent", STUDENT: "Student" };
const PAGE = 50;

export default async function PeoplePage({ searchParams }: { searchParams: Promise<{ q?: string; school?: string; role?: string; status?: string; page?: string }> }) {
  const me = await requireUser(["PLATFORM_ADMIN"]);
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 80);
  const role = (Object.keys(ROLE) as Role[]).includes(sp.role as Role) ? (sp.role as Role) : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.UserWhereInput = {
    ...(sp.school ? { schoolId: sp.school } : {}),
    ...(role ? { role } : {}),
    ...(sp.status === "inactive" ? { active: false } : sp.status === "active" ? { active: true } : {}),
    ...(q ? { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { username: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const [people, total, schools, counts, schoolCount] = await Promise.all([
    db.user.findMany({ where, include: { school: { select: { id: true, name: true, code: true, isDemo: true, isTest: true } } }, orderBy: [{ school: { name: "asc" } }, { role: "asc" }, { lastName: "asc" }], take: PAGE, skip: (page - 1) * PAGE }),
    db.user.count({ where }),
    db.school.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
    db.user.groupBy({ by: ["role"], where: { active: true }, _count: true }),
    db.school.count({ where: { isDemo: false } }),
  ]);
  const n = (r: Role) => counts.find(c => c.role === r)?._count ?? 0;
  const qs = new URLSearchParams(Object.entries({ q, school: sp.school ?? "", role: role ?? "", status: sp.status ?? "" }).filter(([, v]) => v));
  const returnTo = `/admin/people${qs.toString() ? `?${qs}` : ""}${page > 1 ? `${qs.toString() ? "&" : "?"}page=${page}` : ""}`;
  const pageHref = (p: number) => `/admin/people?${new URLSearchParams([...qs.entries(), ["page", String(p)]])}`;
  return (
    <Shell user={me}>
      <div><span className="eyebrow">Platform</span><h1>People<Info label="People">{"Everyone on Presumptuous Learning, across every school. Search by name, email or username, or filter by school, role and status. Email reset link sends an adult a one-time link to choose their own password (if email isn't set up yet, you get the link to pass on). Temporary password sets one you give them, shown once; students use this. Deactivate signs someone out and stops them signing in, without deleting anything. Every action goes in that school's audit log."}</Info></h1></div>
      <div className="grid4" style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
        <div className="stat"><span className="n">{schoolCount}</span><span className="small muted">Schools (not demos)</span></div>
        <div className="stat"><span className="n">{n("STUDENT")}</span><span className="small muted">Active students</span></div>
        <div className="stat"><span className="n">{n("COACH")}</span><span className="small muted">Coaches</span></div>
        <div className="stat"><span className="n">{n("PARENT")}</span><span className="small muted">Parents</span></div>
        <div className="stat"><span className="n">{n("SCHOOL_ADMIN")}</span><span className="small muted">School admins</span></div>
      </div>
      <form className="card" method="get" action="/admin/people">
        <div className="form-grid" style={{ gridTemplateColumns: "2fr 2fr 1fr 1fr" }}>
          <label className="field" htmlFor="pq">Search<input id="pq" name="q" type="search" defaultValue={q} placeholder="Name, email or username" /></label>
          <label className="field" htmlFor="pschool">School<select id="pschool" name="school" defaultValue={sp.school ?? ""}><option value="">All schools</option>{schools.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}</select></label>
          <label className="field" htmlFor="prole">Role<select id="prole" name="role" defaultValue={role ?? ""}><option value="">Everyone</option>{(Object.keys(ROLE) as Role[]).map(r => <option key={r} value={r}>{ROLE[r]}</option>)}</select></label>
          <label className="field" htmlFor="pstatus">Status<select id="pstatus" name="status" defaultValue={sp.status ?? ""}><option value="">Any</option><option value="active">Active</option><option value="inactive">Deactivated</option></select></label>
        </div>
        <div className="row"><button className="btn primary">Search</button>{qs.toString() && <Link className="btn" href="/admin/people">Clear</Link>}<span className="small muted">{total} {total === 1 ? "person" : "people"}</span></div>
      </form>
      {people.length ? (
        <div className="tablewrap"><table>
          <thead><tr><th>Name</th><th>Role</th><th>School</th><th>Signs in with</th><th>Last sign-in</th><th></th></tr></thead>
          <tbody>{people.map(p => (
            <tr key={p.id} style={p.active ? undefined : { opacity: .55 }}>
              <td><b>{p.firstName} {p.lastName}</b>{!p.active && <span className="chip" style={{ marginLeft: 6 }}>Deactivated</span>}</td>
              <td className="small">{ROLE[p.role]}{p.role === "STUDENT" ? ` · Gr ${gradeShort(p.grade ?? 0)}` : ""}</td>
              <td className="small">{p.school ? <Link href={`/admin/schools/${p.school.id}`}>{p.school.name}</Link> : <span className="muted">Platform</span>}{p.school?.isTest && <span className="chip at" style={{ marginLeft: 6 }}>Test</span>}{p.school?.isDemo && <span className="chip" style={{ marginLeft: 6 }}>Demo</span>}</td>
              <td className="small">{p.email ?? (p.username ? <>{p.username} <span className="muted">· code {p.school?.code}</span></> : "—")}{p.googleSub && <span className="chip" style={{ marginLeft: 6 }}>Google</span>}{p.microsoftSub && <span className="chip" style={{ marginLeft: 6 }}>Microsoft</span>}</td>
              <td className="small muted">{p.lastLoginAt ? fmtStamp(p.lastLoginAt, "America/Toronto", { month: "short", day: "numeric", year: "numeric" }) : "Never"}</td>
              <td>{p.id === me.id ? <Link className="btn small" href="/account">Your account</Link> : (
                <div className="row">
                  {p.email && p.role !== "STUDENT" && <form action={adminSendResetLink}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="returnTo" value={returnTo} /><button className="btn small">Email reset link</button></form>}
                  <form action={adminTempPassword}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="returnTo" value={returnTo} /><button className="btn small">Temporary password</button></form>
                  <form action={adminSetActive}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="active" value={String(!p.active)} /><input type="hidden" name="returnTo" value={returnTo} /><button className={`btn small ${p.active ? "danger" : ""}`}>{p.active ? "Deactivate" : "Reactivate"}</button></form>
                </div>
              )}</td>
            </tr>
          ))}</tbody>
        </table></div>
      ) : <div className="empty"><b>Nobody matches</b><span>Try a different search or clear the filters.</span></div>}
      {total > PAGE && (
        <div className="row">
          {page > 1 && <Link className="btn small" href={pageHref(page - 1)}>Previous</Link>}
          <span className="small muted">Page {page} of {Math.ceil(total / PAGE)}</span>
          {page * PAGE < total && <Link className="btn small" href={pageHref(page + 1)}>Next</Link>}
        </div>
      )}
    </Shell>
  );
}
