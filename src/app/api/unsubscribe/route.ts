import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const page = (msg: string) => new NextResponse(
  `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Weekly email</title><body style="font-family:Montserrat,Arial,sans-serif;max-width:520px;margin:60px auto;padding:0 16px;color:#2A2A2D"><h1 style="font-size:22px">${msg}</h1><p>You can turn weekly emails back on from Account after you sign in.</p><p><a href="/login" style="color:#8A5800">Sign in</a></p></body>`,
  { headers: { "Content-Type": "text/html; charset=utf-8" } });

/** One-click unsubscribe from the weekly parent email (link in every email; no sign-in needed). */
export async function GET(req: Request) {
  const t = new URL(req.url).searchParams.get("t") ?? "";
  const user = t.length >= 20 ? await db.user.findUnique({ where: { emailToken: t } }) : null;
  if (!user) return page("That link has expired.");
  await db.user.update({ where: { id: user.id }, data: { weeklyEmail: false } });
  return page("You won't get weekly emails any more.");
}
// Mail apps' one-click unsubscribe sends a POST.
export const POST = GET;
