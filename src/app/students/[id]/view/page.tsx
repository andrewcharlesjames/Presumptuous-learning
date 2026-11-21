import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canViewStudent } from "@/lib/access";
import { auditView } from "@/lib/audit";
import { db } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { Info } from "@/components/Info";
import { StudentCards } from "@/components/StudentCards";
import { WeekView } from "@/components/WeekView";
import { dayInfo, latestScored } from "@/lib/records";
import { weekBoard } from "@/lib/week";
import { fmtLong, todayIn } from "@/lib/dates";
import { gradeName } from "@/lib/subjects";
import { streaks } from "@/lib/schoolday";
import { moodLabel } from "@/lib/prompts";

export const metadata = { title: "Student view" };

/** What a student sees on Today and My week, for their coach or parent. Read-only: no buttons do anything. */
export default async function StudentView({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; view?: string; m?: string }> }) {
  const { id } = await params;
  const viewer = await requireUser(["COACH", "SCHOOL_ADMIN", "PARENT"]);
  if (!(await canViewStudent(viewer, id))) notFound();
  const student = await db.user.findUnique({ where: { id }, include: { school: true } });
  if (!student?.school) notFound();
  const school = student.school;
  await auditView(viewer, id, "student.view");
  const sp = await searchParams;
  const tab = sp.tab === "week" ? "week" : "today";
  const base = `/students/${id}/view`;
  const info = await dayInfo(school);
  const [scored, log, blocks, st] = await Promise.all([
    latestScored(id),
    db.dailyLog.findUnique({ where: { studentId_date: { studentId: id, date: info.date } } }),
    db.scheduleBlock.findMany({ where: { schoolId: school.id }, select: { kind: true, days: true } }),
    streaks(school, [id]),
  ]);
  const wd = (todayIn(school.timezone).getUTCDay() + 6) % 7;
  const kinds = new Set(blocks.filter(b => b.days.includes(wd)).map(b => b.kind));
  const board = scored ? await weekBoard(student, school, info.date) : null;
  const s = st.get(id) ?? { current: 0, best: 0 };
  const back = viewer.role === "PARENT" ? "/parent" : `/students/${id}`;
  return (
    <Shell user={viewer}>
      <div className="studentview-bar" role="note">
        <span><b>Student view:</b> what {student.firstName} sees right now. Buttons are turned off.
          <Info label="Student view">{`This is ${student.firstName}'s own screen, built from the same information, so you can talk it through together or see where they might be stuck. It updates as they work. Nothing you do here changes their work.`}</Info></span>
        <Link className="btn small" href={back}>Back to {viewer.role === "PARENT" ? "my children" : `${student.firstName}'s plan`}</Link>
      </div>
      <nav className="tabs" aria-label="Student screens">
        <Link className="tab" href={base} aria-current={tab === "today" ? "page" : undefined}>Today</Link>
        <Link className="tab" href={`${base}?tab=week`} aria-current={tab === "week" ? "page" : undefined}>My week</Link>
      </nav>
      {tab === "week" ? (
        <WeekView student={student} school={school} base={`${base}?tab=week`} self={false} view={sp.view === "month" ? "month" : "week"} month={sp.m} />
      ) : (
        <>
          <div className="spread">
            <div><span className="eyebrow">{gradeName(student.grade ?? 0)} · {school.name}</span><h1>Hi {student.firstName}. Let&apos;s overreach today.</h1></div>
            <div style={{ textAlign: "right" }}><span className="muted">{fmtLong(info.date)}</span><br /><span className="small"><b>{s.current}</b>-day streak</span></div>
          </div>
          {!scored ? (
            <div className="hero-card"><span className="eyebrow">Getting started</span><h2>Start with your placement assessment</h2><p>{student.firstName} hasn&apos;t finished the placement assessment yet, so this is the first thing they see.</p></div>
          ) : board && (
            <StudentCards board={board} schoolDay={info.schoolDay} reason={info.reason} checkedIn={!!log?.checkedInAt} reflected={!!log?.reflectedAt}
              hasAssembly={kinds.has("ASSEMBLY")} hasReflection={kinds.has("REFLECTION")} coachTitle={school.coachTitle} readOnly weekHref={`${base}?tab=week`} />
          )}
          {info.schoolDay && <p className="small muted">Today so far: {log?.checkedInAt ? "checked in" : "not checked in yet"}{log?.mood ? ` (feeling ${moodLabel(log.mood).toLowerCase()})` : ""} · {log?.reflectedAt ? "reflected" : "no reflection yet"}{log?.goal ? ` · goal: “${log.goal}”` : ""}</p>}
        </>
      )}
    </Shell>
  );
}
