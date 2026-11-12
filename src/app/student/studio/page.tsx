import Link from "next/link";
import { requireSchoolUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { SubmitArt } from "@/components/SubmitArt";
import { ArtCard } from "@/components/ArtCard";
import { artsPromptFor } from "@/lib/prompts";
import { ACCEPT_ATTR, crossoverPrompt } from "@/lib/studio";
import { todayIn } from "@/lib/dates";
import { latestScored, masteredSet } from "@/lib/records";
import { focusFor } from "@/lib/assessment";

export const metadata = { title: "Studio" };

export default async function StudioPage() {
  const { user, school } = await requireSchoolUser(["STUDENT"]);
  const grade = user.grade ?? 0;
  const today = todayIn(school.timezone);
  const [recent, learning, scored, mastered] = await Promise.all([
    db.artwork.findMany({ where: { studentId: user.id }, include: { file: { select: { id: true, mime: true } }, feedback: { include: { author: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "desc" }, take: 6 }),
    db.skillProgress.findFirst({ where: { studentId: user.id, state: "LEARNING" }, orderBy: { updatedAt: "desc" }, select: { skill: true } }),
    latestScored(user.id),
    masteredSet(user.id),
  ]);
  // A skill the student is working on, to connect art to learning.
  let skill = learning?.skill;
  if (!skill && scored) {
    for (const r of scored.results.filter(x => x.status !== "above")) {
      const f = focusFor(r, scored.assessment.grade, scored.skillsAt(r.sid)).find(x => !mastered.has(`${r.sid}|${x.skill}`));
      if (f) { skill = f.skill; break; }
    }
  }
  const daily = artsPromptFor(today, grade);
  const cross = skill ? crossoverPrompt(skill, grade) : null;
  const prompts = [daily, ...(cross ? [cross] : [])];
  return (
    <Shell user={user}>
      <div className="spread">
        <div><span className="eyebrow">Arts</span><h1>Studio</h1></div>
        <Link className="btn" href={`/students/${user.id}/portfolio`}>My portfolio</Link>
      </div>
      <section className="grid2">
        <div className="card"><span className="eyebrow">Today&apos;s creative prompt</span><p style={{ fontSize: "1.1rem" }}>{daily}</p></div>
        {cross && <div className="card"><span className="eyebrow">Connect it to your learning</span><p style={{ fontSize: "1.1rem" }}>{cross}</p></div>}
      </section>
      <SubmitArt prompts={prompts} accept={ACCEPT_ATTR} />
      <section className="stack">
        <h2>Recent work</h2>
        {recent.length ? (
          <div className="grid3" style={{ alignItems: "start" }}>{recent.map(a => (
            <ArtCard key={a.id} art={a} tz={school.timezone} canFeature canDelete canGiveFeedback={false} returnTo="/student/studio" />
          ))}</div>
        ) : <div className="empty"><b>Nothing here yet</b><span>Hand in today&apos;s prompt to start your portfolio.</span></div>}
      </section>
    </Shell>
  );
}
