import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { renderEmail } from "@/lib/email";
import { weeklyEmailFor } from "@/lib/weekly";

/** A parent's preview of this week's email, exactly as it would be sent. */
export async function GET(req: Request) {
  const user = await getUser();
  if (!user || user.role !== "PARENT") return NextResponse.redirect(new URL("/login", req.url), 303);
  const email = await weeklyEmailFor(user.id);
  const html = email ? renderEmail(email).html : `<!doctype html><body style="font-family:Arial;padding:40px">No school days this week yet, so there's nothing to send.</body>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
