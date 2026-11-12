import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { db } from "./db";
import { newToken, sha256 } from "./passwords";

export const SESSION_COOKIE = "pl_session";
const SESSION_DAYS = 14;

export async function createSession(userId: string) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  await db.session.create({ data: { id: sha256(token), userId, expiresAt } });
  await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

/** The signed-in user (with school), or null. Cached per request. */
export const getUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { id: sha256(token) },
    include: { user: { include: { school: true } } },
  });
  if (!session || session.expiresAt < new Date() || !session.user.active) return null;
  return session.user;
});
export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getUser>>>;

export function homeFor(role: Role): string {
  switch (role) {
    case "PLATFORM_ADMIN": return "/admin";
    case "SCHOOL_ADMIN": return "/school";
    case "COACH": return "/coach";
    case "PARENT": return "/parent";
    case "STUDENT": return "/student";
  }
}

/** Require a signed-in user, optionally with one of the given roles. */
export async function requireUser(roles?: Role[]): Promise<CurrentUser> {
  const user = await getUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect(homeFor(user.role));
  return user;
}

/** For school-scoped pages: the user plus their (required) school. */
export async function requireSchoolUser(roles: Role[]) {
  const user = await requireUser(roles);
  if (!user.school) redirect("/login");
  return { user, school: user.school };
}

/* ---- simple in-memory sign-in throttle (per instance) ---- */
const attempts = new Map<string, { n: number; until: number }>();
export function throttled(key: string): boolean {
  const a = attempts.get(key);
  return !!a && a.n >= 8 && a.until > Date.now();
}
export function recordFailure(key: string) {
  const a = attempts.get(key);
  const now = Date.now();
  if (!a || a.until < now) attempts.set(key, { n: 1, until: now + 15 * 60000 });
  else a.n++;
}
export function clearFailures(key: string) {
  attempts.delete(key);
}
