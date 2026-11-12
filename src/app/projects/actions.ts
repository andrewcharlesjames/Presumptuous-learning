"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSchoolUser } from "@/lib/auth";
import { canManageStudent } from "@/lib/access";
import { db } from "@/lib/db";
import { setFlash } from "@/lib/flash";
import { schoolYearOf, todayIn } from "@/lib/dates";
import { defaultLaunchDay, INTERVIEW, MILESTONES, milestoneDates, type Idea, type ProjectTypeName } from "@/lib/projects";
import { suggestIdeas } from "@/lib/projects-ai";
import { aiAllowedFor } from "@/lib/consent";

const isType = (x: string): x is ProjectTypeName => x === "LIFE_SKILLS" || x === "PURPOSE";
const clip = (v: FormDataEntryValue | null, n: number) => String(v ?? "").trim().slice(0, n);
const safeUrl = (s: string) => /^https?:\/\/[^\s]+$/i.test(s) ? s.slice(0, 500) : "";

async function ownProject(id: string) {
  const { user, school } = await requireSchoolUser(["STUDENT"]);
  const p = await db.project.findFirst({ where: { id, studentId: user.id }, include: { milestones: { orderBy: { position: "asc" } } } });
  if (!p) redirect("/student/projects");
  return { user, school, p };
}

/** Start this year's Life Skills or Purpose project with its nine milestones. */
export async function startProject(form: FormData) {
  const { user, school } = await requireSchoolUser(["STUDENT"]);
  const type = String(form.get("type"));
  if (!isType(type)) redirect("/student/projects");
  const today = todayIn(school.timezone);
  const schoolYear = schoolYearOf(today);
  const existing = await db.project.findUnique({ where: { studentId_type_schoolYear: { studentId: user.id, type, schoolYear } } });
  if (existing) redirect(`/student/projects/${existing.id}`);
  const dates = milestoneDates(type, schoolYear, school.launchDay ?? defaultLaunchDay(schoolYear), today);
  const p = await db.project.create({
    data: {
      schoolId: school.id, studentId: user.id, type, schoolYear,
      milestones: { create: MILESTONES[type].map((m, position) => ({ position, key: m.key, title: m.title, description: m.description, dueDate: dates[position] })) },
    },
  });
  redirect(`/student/projects/${p.id}`);
}

/** Save the discovery answers and ask the AI for ideas. */
export async function runDiscovery(_: unknown, form: FormData): Promise<{ error?: string } | undefined> {
  const { user, school, p } = await ownProject(String(form.get("id")));
  if (!(await aiAllowedFor(user.id, school))) return { error: "Idea suggestions need a parent's permission for AI features. Write your own idea below for now." };
  const answers = Object.fromEntries(INTERVIEW.map(i => [i.key, clip(form.get(i.key), 500)]));
  if (Object.values(answers).filter(Boolean).length < 3) return { error: "Answer at least three questions so the ideas fit you." };
  await db.project.update({ where: { id: p.id }, data: { interview: answers } });
  const ideas = await suggestIdeas(p.type, user.grade ?? 0, answers);
  if (!ideas) return { error: "Ideas couldn't be written just now. Try again in a minute, or write your own idea below." };
  await db.project.update({ where: { id: p.id }, data: { ideas } });
  revalidatePath(`/student/projects/${p.id}`);
  redirect(`/student/projects/${p.id}`);
}

/** Pick an AI idea (or "own") to start the proposal; this completes the Discovery milestone. */
export async function chooseIdea(form: FormData) {
  const { p } = await ownProject(String(form.get("id")));
  const n = Number(form.get("idea"));
  const ideas = (p.ideas ?? []) as Idea[];
  const idea = Number.isInteger(n) ? ideas[n] : undefined;
  await db.project.update({
    where: { id: p.id },
    data: idea ? { title: idea.title, oneLiner: idea.oneLiner, plan: idea.firstSteps.map(s => `- ${s}`).join("\n") } : { title: clip(form.get("ownTitle"), 120) || "My project" },
  });
  const discovery = p.milestones.find(m => m.key === "discovery");
  if (discovery && discovery.status !== "APPROVED") {
    await db.projectMilestone.update({ where: { id: discovery.id }, data: { status: "APPROVED", evidence: idea ? `Chose: ${idea.title}` : "Chose my own idea", submittedAt: new Date(), reviewedAt: new Date() } });
  }
  revalidatePath(`/student/projects/${p.id}`); redirect(`/student/projects/${p.id}`);
}

/** Save the proposal; optionally hand it in as the Proposal milestone. */
export async function saveProposal(form: FormData) {
  const { p } = await ownProject(String(form.get("id")));
  const data = { title: clip(form.get("title"), 120), oneLiner: clip(form.get("oneLiner"), 240), problem: clip(form.get("problem"), 1000), audience: clip(form.get("audience"), 500), plan: clip(form.get("plan"), 2000) };
  if (!data.title) { await setFlash({ tone: "error", text: "Give your project a title." }); revalidatePath(`/student/projects/${p.id}`); redirect(`/student/projects/${p.id}`); }
  await db.project.update({ where: { id: p.id }, data });
  const proposal = p.milestones.find(m => m.key === "proposal");
  if (form.get("submit") === "1" && proposal && proposal.status !== "APPROVED") {
    if (!data.oneLiner || !data.problem || !data.audience || !data.plan) {
      await setFlash({ tone: "error", text: "Fill in every part of the proposal before you hand it in." });
      revalidatePath(`/student/projects/${p.id}`); redirect(`/student/projects/${p.id}`);
    }
    await db.projectMilestone.update({ where: { id: proposal.id }, data: { status: "SUBMITTED", evidence: data.oneLiner, submittedAt: new Date() } });
    await setFlash({ tone: "ok", text: "Proposal handed in. Your coach will review it." });
  } else await setFlash({ tone: "ok", text: "Saved." });
  revalidatePath(`/student/projects/${p.id}`);
  redirect(`/student/projects/${p.id}`);
}

/** Hand in a milestone with what you did and an optional link. */
export async function submitMilestone(form: FormData) {
  const { p } = await ownProject(String(form.get("id")));
  const m = p.milestones.find(x => x.id === String(form.get("milestoneId")));
  const evidence = clip(form.get("evidence"), 3000);
  const link = safeUrl(clip(form.get("link"), 500));
  if (!m || m.status === "APPROVED" || m.key === "discovery" || m.key === "proposal") redirect(`/student/projects/${p.id}`);
  if (!evidence) { await setFlash({ tone: "error", text: "Describe what you did for this step." }); redirect(`/student/projects/${p.id}`); }
  const earlier = p.milestones.filter(x => x.position < m.position && x.status !== "APPROVED");
  if (earlier.length) { await setFlash({ tone: "error", text: `Finish “${earlier[0].title}” first.` }); redirect(`/student/projects/${p.id}`); }
  await db.projectMilestone.update({ where: { id: m.id }, data: { status: "SUBMITTED", evidence, link, submittedAt: new Date() } });
  await setFlash({ tone: "ok", text: `“${m.title}” handed in. Your coach will review it.` });
  revalidatePath(`/student/projects/${p.id}`);
  redirect(`/student/projects/${p.id}`);
}

/** Coach approves a milestone or sends it back with feedback. */
export async function reviewMilestone(form: FormData) {
  const { user } = await requireSchoolUser(["COACH", "SCHOOL_ADMIN"]);
  const id = String(form.get("milestoneId") ?? "");
  const decision = String(form.get("decision"));
  const feedback = clip(form.get("feedback"), 1000);
  const back = String(form.get("returnTo") ?? "/coach");
  const returnTo = back.startsWith("/") && !back.startsWith("//") ? back : "/coach";
  const m = await db.projectMilestone.findUnique({ where: { id }, include: { project: true } });
  if (!m || !(await canManageStudent(user, m.project.studentId)) || !["APPROVED", "NEEDS_WORK"].includes(decision)) redirect(returnTo);
  if (decision === "NEEDS_WORK" && !feedback) { await setFlash({ tone: "error", text: "Say what needs work so the student knows what to change." }); redirect(returnTo); }
  await db.projectMilestone.update({ where: { id }, data: { status: decision as "APPROVED" | "NEEDS_WORK", feedback, reviewedAt: new Date(), reviewedById: user.id } });
  await setFlash({ tone: "ok", text: decision === "APPROVED" ? `Approved “${m.title}”.` : `Sent “${m.title}” back with your feedback.` });
  revalidatePath(returnTo);
  redirect(returnTo);
}
