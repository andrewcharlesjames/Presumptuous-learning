import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession, getUser, homeFor } from "@/lib/auth";
import { finishFlow, isProvider, PROVIDER_LABEL } from "@/lib/sso";
import { appUrl } from "@/lib/email";
import { audit } from "@/lib/audit";
import { setFlash } from "@/lib/flash";

type Flow = { p: string; state: string; nonce: string; verifier: string; link: boolean };

export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const url = new URL(req.url);
  const jar = await cookies();
  const raw = jar.get("pl_oauth")?.value;
  jar.delete({ name: "pl_oauth", path: "/api/auth" });
  let flow: Flow | null = null;
  try { flow = raw ? JSON.parse(Buffer.from(raw, "base64url").toString()) : null; } catch { flow = null; }
  const fail = (code: string, link = flow?.link) => NextResponse.redirect(`${appUrl()}${link ? "/account" : "/login"}?sso=${code}`);
  if (!isProvider(provider) || !flow || flow.p !== provider) return fail("state");
  if (url.searchParams.get("error")) return fail("denied");
  if (!url.searchParams.get("state") || url.searchParams.get("state") !== flow.state || !url.searchParams.get("code")) return fail("state");

  const id = await finishFlow(provider, url.searchParams.get("code")!, flow.verifier, flow.nonce);
  if ("error" in id) return fail(id.error);
  const field = provider === "google" ? "googleSub" : "microsoftSub";

  if (flow.link) {
    const me = await getUser();
    if (!me) return fail("state", false);
    const other = await db.user.findFirst({ where: { [field]: id.sub } });
    if (other && other.id !== me.id) return fail("taken");
    await db.user.update({ where: { id: me.id }, data: { [field]: id.sub } });
    await audit(me, "account.link", { detail: PROVIDER_LABEL[provider] });
    await setFlash({ tone: "ok", text: `${PROVIDER_LABEL[provider]} is connected. Next time, use Sign in with ${PROVIDER_LABEL[provider]}.` });
    return NextResponse.redirect(`${appUrl()}/account`);
  }

  let user = await db.user.findFirst({ where: { [field]: id.sub } });
  // Google confirms the email belongs to this person, so a matching account can be connected on first use.
  if (!user && provider === "google" && id.email && id.emailVerified) {
    const byEmail = await db.user.findUnique({ where: { email: id.email } });
    if (byEmail && !byEmail[field]) {
      user = await db.user.update({ where: { id: byEmail.id }, data: { [field]: id.sub } });
      await audit(user, "account.link", { detail: "Google, on first sign-in" });
    }
  }
  if (!user) return fail(provider === "microsoft" ? "not_linked" : "no_account");
  if (user.role === "STUDENT") return fail("student");
  if (!user.active) return fail("no_account");
  await createSession(user.id);
  return NextResponse.redirect(`${appUrl()}${homeFor(user.role)}`);
}
