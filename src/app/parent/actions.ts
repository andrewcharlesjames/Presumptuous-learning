"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser, recordFailure, throttled } from "@/lib/auth";
import { db } from "@/lib/db";
import { setFlash } from "@/lib/flash";

export async function linkChild(form: FormData) {
  const user = await requireUser(["PARENT"]);
  const code = String(form.get("code") ?? "").trim().toUpperCase();
  const key = `link:${user.id}`;
  if (throttled(key)) {
    await setFlash({ tone: "error", text: "Too many attempts. Wait 15 minutes." });
    redirect("/parent");
  }
  const student = code ? await db.user.findUnique({ where: { familyCode: code } }) : null;
  if (!student || student.role !== "STUDENT") {
    recordFailure(key);
    await setFlash({ tone: "error", text: "We couldn't find that family code. Check it with the school." });
    redirect("/parent");
  }
  if (student.schoolId !== user.schoolId) {
    await setFlash({ tone: "error", text: "That child attends a different school. For now, each parent account connects to one school; create a separate account with another email." });
    redirect("/parent");
  }
  await db.parentLink.upsert({
    where: { parentId_studentId: { parentId: user.id, studentId: student.id } },
    create: { parentId: user.id, studentId: student.id },
    update: {},
  });
  await setFlash({ tone: "ok", text: `${student.firstName} is now on your dashboard.` });
  revalidatePath("/parent");
  redirect("/parent");
}
