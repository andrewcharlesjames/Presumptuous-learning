import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { advance, currentView } from "@/lib/runner";
import { Quiz } from "./Quiz";

export const metadata = { title: "Assessment" };

export default async function AssessmentPage() {
  const user = await requireUser(["STUDENT"]);
  let a = await db.assessment.findFirst({ where: { studentId: user.id, status: "IN_PROGRESS" } });
  if (a && a.mode !== "adaptive") {
    // A Phase 1 assessment left half-done: replace it with the adaptive version.
    await db.assessment.delete({ where: { id: a.id } });
    a = null;
  }
  if (!a) redirect("/student");
  const step = await advance(a);
  const view = step.done ? null : await currentView(a, step.questions, step.answers);
  if (!view) redirect("/student");
  return (
    <Shell user={user}>
      <Quiz id={a.id} studentId={user.id} initial={view} readAloud={a.grade <= 2} />
    </Shell>
  );
}
