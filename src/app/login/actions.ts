"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { clearFailures, createSession, destroySession, getUser, homeFor, recordFailure, throttled } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/passwords";
import { setFlash } from "@/lib/flash";

export type FormState = { error?: string } | undefined;

async function clientKey(id: string) {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  return `${ip}:${id.toLowerCase()}`;
}

const adultSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1) });

export async function signInAdult(_: FormState, form: FormData): Promise<FormState> {
  const parsed = adultSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: "Enter your email and password." };
  const key = await clientKey(parsed.data.email);
  if (throttled(key)) return { error: "Too many attempts. Wait 15 minutes and try again." };
  const user = await db.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (!user || !user.active || user.role === "STUDENT" || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    recordFailure(key);
    return { error: "That email and password don't match. Check them and try again." };
  }
  clearFailures(key);
  await createSession(user.id);
  redirect(homeFor(user.role));
}

const studentSchema = z.object({ code: z.string().trim().min(2), username: z.string().trim().min(2), password: z.string().min(1) });

export async function signInStudent(_: FormState, form: FormData): Promise<FormState> {
  const parsed = studentSchema.safeParse({ code: form.get("code"), username: form.get("username"), password: form.get("password") });
  if (!parsed.success) return { error: "Enter your school code, username and password." };
  const { code, username, password } = parsed.data;
  const key = await clientKey(`${code}/${username}`);
  if (throttled(key)) return { error: "Too many attempts. Ask your coach for help." };
  const school = await db.school.findUnique({ where: { code: code.toUpperCase() } });
  const user = school && await db.user.findUnique({ where: { schoolId_username: { schoolId: school.id, username: username.toLowerCase() } } });
  if (!user || !user.active || user.role !== "STUDENT" || !(await verifyPassword(password, user.passwordHash))) {
    recordFailure(key);
    return { error: "That didn't match. Check your school code, username and password, or ask your coach." };
  }
  clearFailures(key);
  await createSession(user.id);
  redirect("/student");
}

const joinSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  email: z.string().trim().email(),
  password: z.string().min(10, "Use at least 10 characters for your password."),
  code: z.string().trim().min(8),
});

/** Parent creates an account with a family code from the school. */
export async function joinAsParent(_: FormState, form: FormData): Promise<FormState> {
  const parsed = joinSchema.safeParse({ firstName: form.get("firstName"), lastName: form.get("lastName"), email: form.get("email"), password: form.get("password"), code: form.get("code") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  const d = parsed.data;
  const key = await clientKey(`join:${d.email}`);
  if (throttled(key)) return { error: "Too many attempts. Wait 15 minutes and try again." };
  const student = await db.user.findUnique({ where: { familyCode: d.code.toUpperCase() } });
  if (!student || student.role !== "STUDENT") {
    recordFailure(key);
    return { error: "We couldn't find that family code. Check it with your child's school." };
  }
  if (await db.user.findUnique({ where: { email: d.email.toLowerCase() } })) {
    return { error: "An account already uses that email. Sign in, then add this child from your dashboard." };
  }
  const parent = await db.user.create({
    data: {
      role: "PARENT", schoolId: student.schoolId, email: d.email.toLowerCase(), firstName: d.firstName, lastName: d.lastName,
      passwordHash: await hashPassword(d.password),
      children: { create: { studentId: student.id } },
    },
  });
  const byName = `${d.firstName} ${d.lastName}`;
  for (const [kind, on] of [["PLATFORM", form.get("consentPlatform") === "on"], ["AI", form.get("consentAi") === "on"]] as const) {
    if (on) await db.consent.upsert({ where: { studentId_kind: { studentId: student.id, kind } }, create: { studentId: student.id, kind, granted: true, givenBy: parent.id, byName }, update: { granted: true, givenBy: parent.id, byName } });
  }
  await createSession(parent.id);
  await setFlash({ tone: "ok", text: `Welcome. You're now connected to ${student.firstName}.` });
  redirect("/parent");
}

export async function signOut() {
  await destroySession();
  redirect("/login");
}

const pwSchema = z.object({ current: z.string().min(1), next: z.string().min(10, "Use at least 10 characters.") });

export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  const user = await getUser();
  if (!user) redirect("/login");
  const parsed = pwSchema.safeParse({ current: form.get("current"), next: form.get("next") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  if (!(await verifyPassword(parsed.data.current, user.passwordHash))) return { error: "Your current password is wrong." };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(parsed.data.next) } });
  await setFlash({ tone: "ok", text: "Password changed." });
  redirect(homeFor(user.role));
}
