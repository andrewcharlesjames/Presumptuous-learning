import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { QuestionForm } from "../QuestionForm";
import { ensureBankSeeded } from "@/lib/questions";

export default async function EditQuestion({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ subject?: string; grade?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser(["PLATFORM_ADMIN"]);
  await ensureBankSeeded();
  const q = id === "new" ? undefined : await db.question.findUnique({ where: { id } });
  if (id !== "new" && !q) notFound();
  return (
    <Shell user={user}>
      <div><Link href="/admin/questions" className="small">← Question bank</Link><h1>{q ? "Edit question" : "Add a question"}</h1>
        {q && <p className="muted small" style={{ marginTop: 6 }}>{q.source === "builtin" ? "Built-in question. Your edits are kept; it won't be reset." : "Added in the editor."}</p>}</div>
      <QuestionForm q={q ?? undefined} subject={sp.subject} grade={sp.grade ? Number(sp.grade) : undefined} />
    </Shell>
  );
}
