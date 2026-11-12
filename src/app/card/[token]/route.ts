import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession, recordFailure, throttled } from "@/lib/auth";
import { appUrl } from "@/lib/email";

/** A student's printed sign-in card: scanning the QR code opens this link and signs them in. */
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ip = ((await headers()).get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  const key = `${ip}:card`;
  if (throttled(key)) return NextResponse.redirect(`${appUrl()}/login?card=busy`);
  const user = token.length >= 20 ? await db.user.findUnique({ where: { cardToken: token } }) : null;
  if (!user || !user.active || user.role !== "STUDENT") {
    recordFailure(key);
    return NextResponse.redirect(`${appUrl()}/login?card=old`);
  }
  await createSession(user.id);
  return NextResponse.redirect(`${appUrl()}/student`);
}
