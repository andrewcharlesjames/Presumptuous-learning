// ID token checks for Google and Microsoft sign-in (no server imports, so they can be unit tested).
export type Identity = { sub: string; email: string | null; emailVerified: boolean; name: string };

export function parseIdToken(t?: string): Record<string, unknown> | null {
  const part = t?.split(".")[1];
  if (!part) return null;
  try { return JSON.parse(Buffer.from(part, "base64url").toString()); } catch { return null; }
}

export function checkClaims(p: "google" | "microsoft", claims: Record<string, unknown> | null, clientId: string, nonce: string, now = Date.now()): Identity | { error: string } {
  if (!claims) return { error: "token" };
  const issOk = p === "google" ? ["https://accounts.google.com", "accounts.google.com"].includes(String(claims.iss)) : /^https:\/\/login\.microsoftonline\.com\/[0-9a-f-]{36}\/v2\.0$/.test(String(claims.iss));
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!issOk || !aud.includes(clientId) || typeof claims.exp !== "number" || claims.exp * 1000 < now - 60000 || claims.nonce !== nonce || typeof claims.sub !== "string") return { error: "token" };
  const email = typeof claims.email === "string" ? claims.email.toLowerCase() : typeof claims.preferred_username === "string" && claims.preferred_username.includes("@") ? claims.preferred_username.toLowerCase() : null;
  return { sub: claims.sub, email, emailVerified: p === "google" && claims.email_verified === true, name: String(claims.name ?? "") };
}

