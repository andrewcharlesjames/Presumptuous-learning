import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { appUrl } from "./email";
import { checkClaims, parseIdToken, type Identity } from "./sso-claims";
export type { Identity };

/**
 * Sign in with Google or Microsoft (OpenID Connect, authorization code + PKCE).
 * The ID token comes straight from the provider's token endpoint over TLS with our client secret,
 * which OpenID Connect allows in place of checking its signature; we still check issuer, audience, expiry and nonce.
 */
export type Provider = "google" | "microsoft";
export const PROVIDER_LABEL: Record<Provider, string> = { google: "Google", microsoft: "Microsoft" };

type Conf = { clientId: string; clientSecret: string; authUrl: string; tokenUrl: string; issuer: (iss: string) => boolean };

export function providerConf(p: Provider): Conf | null {
  if (p === "google") {
    const clientId = process.env.GOOGLE_CLIENT_ID, clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;
    return { clientId, clientSecret, authUrl: "https://accounts.google.com/o/oauth2/v2/auth", tokenUrl: "https://oauth2.googleapis.com/token",
      issuer: iss => iss === "https://accounts.google.com" || iss === "accounts.google.com" };
  }
  const clientId = process.env.MICROSOFT_CLIENT_ID, clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const tenant = process.env.MICROSOFT_TENANT || "common";
  return { clientId, clientSecret, authUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`, tokenUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    issuer: iss => /^https:\/\/login\.microsoftonline\.com\/[0-9a-f-]{36}\/v2\.0$/.test(iss) };
}

export const ssoProviders = () => ({ google: !!providerConf("google"), microsoft: !!providerConf("microsoft") });
export const isProvider = (x: string): x is Provider => x === "google" || x === "microsoft";
export const redirectUri = (p: Provider) => `${appUrl()}/api/auth/${p}/callback`;

const b64url = (b: Buffer) => b.toString("base64url");
export function newFlow() {
  const verifier = b64url(randomBytes(32));
  return { state: b64url(randomBytes(16)), nonce: b64url(randomBytes(16)), verifier, challenge: b64url(createHash("sha256").update(verifier).digest()) };
}

export function authorizeUrl(p: Provider, f: { state: string; nonce: string; challenge: string }) {
  const c = providerConf(p)!;
  const q = new URLSearchParams({
    client_id: c.clientId, redirect_uri: redirectUri(p), response_type: "code", scope: "openid email profile",
    state: f.state, nonce: f.nonce, code_challenge: f.challenge, code_challenge_method: "S256", prompt: "select_account",
  });
  return `${c.authUrl}?${q}`;
}


/** Exchanges the code and returns the checked identity, or an error message. */
export async function finishFlow(p: Provider, code: string, verifier: string, nonce: string): Promise<Identity | { error: string }> {
  const c = providerConf(p);
  if (!c) return { error: "not_configured" };
  const r = await fetch(c.tokenUrl, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal: AbortSignal.timeout(15000),
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri(p), client_id: c.clientId, client_secret: c.clientSecret, code_verifier: verifier }),
  }).catch(() => null);
  if (!r?.ok) return { error: "token" };
  const tok = (await r.json().catch(() => ({}))) as { id_token?: string };
  const claims = parseIdToken(tok.id_token);
  return checkClaims(p, claims, c.clientId, nonce);
}

export const SSO_ERRORS: Record<string, string> = {
  not_configured: "That sign-in option isn't set up yet.",
  state: "That sign-in took too long or was started in another window. Try again.",
  token: "We couldn't confirm that sign-in with the provider. Try again.",
  denied: "Sign-in was cancelled.",
  not_linked: "That account isn't connected to Presumptuous Learning yet. Sign in with your email and password once, then connect it from Account.",
  no_account: "We couldn't find a Presumptuous Learning account with that email. Ask your school to add you, or sign in with your password.",
  student: "Students sign in with their school code and username, or their sign-in card.",
  taken: "That account is already connected to another person on Presumptuous Learning.",
};
