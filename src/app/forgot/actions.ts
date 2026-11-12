"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { clearFailures, createSession, homeFor, recordFailure, throttled } from "@/lib/auth";
import { hashPassword, newToken, sha256 } from "@/lib/passwords";
import { appUrl, sendEmail } from "@/lib/email";
import { setFlash } from "@/lib/flash";
import { audit } from "@/lib/audit";

export type ResetState = { error?: string; sent?: boolean } | undefined;
const RESET_MINUTES = 60;

async function ipKey(id: string) {
  const ip = ((await headers()).get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  return `${ip}:${id}`;
}

/** Emails a reset link. Always answers the same way, so it can't be used to find out who has an account. */
export async function requestReset(_: ResetState, form: FormData): Promise<ResetState> {
  const email = z.string().trim().email().safeParse(form.get("email"));
  if (!email.success) return { error: "Enter the email you sign in with." };
  const key = await ipKey(`reset:${email.data.toLowerCase()}`);
  if (throttled(key)) return { sent: true };
  recordFailure(key); // counts requests: at most 8 per 15 minutes per address and email
  const user = await db.user.findUnique({ where: { email: email.data.toLowerCase() } });
  if (user && user.active && user.role !== "STUDENT") {
    const token = newToken();
    await db.passwordReset.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_MINUTES * 60000) } });
    await sendEmail({
      kind: "password_reset", to: user.email!, schoolId: user.schoolId, subject: "Reset your Presumptuous Learning password",
      heading: `Hi ${user.firstName}, let's reset your password`,
      paragraphs: [`Someone (hopefully you) asked to reset the password for ${user.email}. The link works once, for ${RESET_MINUTES} minutes.`, "If you didn't ask, ignore this email. Your password stays the same."],
      button: { label: "Choose a new password", href: `${appUrl()}/reset/${token}` },
    });
  }
  return { sent: true };
}

const resetSchema = z.object({ token: z.string().min(20), password: z.string().min(10, "Use at least 10 characters."), confirm: z.string() });

export async function resetPassword(_: ResetState, form: FormData): Promise<ResetState> {
  const p = resetSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Check the form." };
  if (p.data.password !== p.data.confirm) return { error: "The two passwords don't match." };
  const reset = await db.passwordReset.findUnique({ where: { tokenHash: sha256(p.data.token) }, include: { user: true } });
  if (!reset || reset.usedAt || reset.expiresAt < new Date() || !reset.user.active) return { error: "This link has expired or was already used. Ask for a new one." };
  const user = reset.user;
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(p.data.password) } }),
    db.passwordReset.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
    db.session.deleteMany({ where: { userId: user.id } }), // sign out everywhere
  ]);
  await audit(user, "password.self_reset", { detail: "By email link" });
  clearFailures(await ipKey(`reset:${user.email}`));
  await createSession(user.id);
  await setFlash({ tone: "ok", text: "Your password is changed and you're signed in. Any other devices were signed out." });
  redirect(homeFor(user.role));
}
