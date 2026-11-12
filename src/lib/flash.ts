import "server-only";
import { cookies } from "next/headers";

/**
 * One-off messages shown after a form action (including one-time credentials).
 * Stored in a short-lived httpOnly cookie, never in the URL.
 */
export type Flash = { tone: "ok" | "error"; text: string; secret?: { label: string; value: string }[] };

const NAME = "pl_flash";

export async function setFlash(f: Flash) {
  (await cookies()).set(NAME, Buffer.from(JSON.stringify(f)).toString("base64url"), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 45,
  });
}

export async function readFlash(): Promise<Flash | null> {
  const v = (await cookies()).get(NAME)?.value;
  if (!v) return null;
  try {
    return JSON.parse(Buffer.from(v, "base64url").toString()) as Flash;
  } catch {
    return null;
  }
}

export async function clearFlashCookie() {
  (await cookies()).delete(NAME);
}
