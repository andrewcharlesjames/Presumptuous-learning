import "server-only";
import { db } from "./db";
import { newToken, sha256 } from "./passwords";
import { appUrl, sendEmail } from "./email";

export const RESET_MINUTES = 60;

/**
 * Makes a one-time reset link for an adult and emails it.
 * Returns the link too, so an admin can pass it on by hand when email isn't set up or didn't arrive.
 */
export async function issueResetLink(user: { id: string; email: string | null; firstName: string; schoolId: string | null }, sentBy?: string) {
  if (!user.email) return null;
  const token = newToken();
  await db.passwordReset.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_MINUTES * 60000) } });
  const link = `${appUrl()}/reset/${token}`;
  const status = await sendEmail({
    kind: "password_reset", to: user.email, schoolId: user.schoolId, subject: "Reset your Presumptuous Learning password",
    heading: `Hi ${user.firstName}, let's reset your password`,
    paragraphs: [
      sentBy ? `${sentBy} sent you a link to choose a new password for ${user.email}. It works once, for ${RESET_MINUTES} minutes.` : `Someone (hopefully you) asked to reset the password for ${user.email}. The link works once, for ${RESET_MINUTES} minutes.`,
      "If you didn't expect this, ignore this email. Your password stays the same.",
    ],
    button: { label: "Choose a new password", href: link },
  });
  return { link, status };
}
