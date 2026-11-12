"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { setFlash } from "@/lib/flash";
import { audit } from "@/lib/audit";

export async function disconnectProvider(form: FormData) {
  const user = await requireUser();
  const p = String(form.get("provider"));
  if (p !== "google" && p !== "microsoft") redirect("/account");
  await db.user.update({ where: { id: user.id }, data: p === "google" ? { googleSub: null } : { microsoftSub: null } });
  await audit(user, "account.unlink", { detail: p === "google" ? "Google" : "Microsoft" });
  await setFlash({ tone: "ok", text: `${p === "google" ? "Google" : "Microsoft"} is disconnected. Sign in with your email and password.` });
  revalidatePath("/account");
  redirect("/account");
}

export async function setWeeklyEmail(form: FormData) {
  const user = await requireUser(["PARENT"]);
  const on = form.get("on") === "true";
  await db.user.update({ where: { id: user.id }, data: { weeklyEmail: on } });
  await setFlash({ tone: "ok", text: on ? "You'll get a progress email every Friday afternoon." : "Weekly emails are off. You can turn them back on here any time." });
  revalidatePath("/account");
  redirect("/account");
}
