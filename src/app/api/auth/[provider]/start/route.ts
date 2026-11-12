import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { authorizeUrl, isProvider, newFlow, providerConf } from "@/lib/sso";
import { appUrl } from "@/lib/email";

const FLOW_COOKIE = "pl_oauth";

/** /api/auth/google/start (sign in) or ?link=1 (connect to the signed-in account). */
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!isProvider(provider) || !providerConf(provider)) return NextResponse.redirect(`${appUrl()}/login?sso=not_configured`);
  const link = new URL(req.url).searchParams.get("link") === "1";
  if (link && !(await getUser())) return NextResponse.redirect(`${appUrl()}/login`);
  const f = newFlow();
  (await cookies()).set(FLOW_COOKIE, Buffer.from(JSON.stringify({ p: provider, state: f.state, nonce: f.nonce, verifier: f.verifier, link })).toString("base64url"), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/auth", maxAge: 600,
  });
  return NextResponse.redirect(authorizeUrl(provider, f));
}
