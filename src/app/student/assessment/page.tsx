import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { publicQuestion, type Answer, type StoredQuestion } from "@/lib/assessment";
import { Quiz } from "./Quiz";

export const metadata = { title: "Assessment" };

export default async function AssessmentPage() {
  const user = await requireUser(["STUDENT"]);
  const a = await db.assessment.findFirst({ where: { studentId: user.id, status: "IN_PROGRESS" } });
  if (!a) redirect("/student");
  const questions = (a.questions as StoredQuestion[]).map(q => publicQuestion(q, a.grade));
  const answers = a.answers as Answer[];
  // Map stored original indexes back to display positions for questions already answered.
  const picked = (a.questions as StoredQuestion[]).map((q, i) => answers[i] === null ? null : answers[i] === -1 ? -1 : q.order.indexOf(answers[i] as number));
  const first = picked.findIndex(p => p === null);
  return (
    <Shell user={user}>
      <Quiz id={a.id} questions={questions} initial={picked} start={first < 0 ? questions.length - 1 : first} readAloud={a.grade <= 2} />
    </Shell>
  );
}
