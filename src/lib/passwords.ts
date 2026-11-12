import { randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

/** Format: scrypt$<salt b64>$<hash b64> */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, saltB64, hashB64] = stored.split("$");
  if (algo !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

const WORDS = ["maple", "river", "comet", "otter", "cedar", "lynx", "falcon", "harbour", "aurora", "pine", "trillium", "canoe",
  "loon", "beaver", "summit", "meadow", "glacier", "prairie", "spruce", "thunder", "willow", "bison", "orca", "heron"];

/** Easy for a child to type, e.g. "otter-482-pine". */
export function kidPassword(): string {
  return `${WORDS[randomInt(WORDS.length)]}-${randomInt(100, 1000)}-${WORDS[randomInt(WORDS.length)]}`;
}

/** Temporary password for adults. */
export function tempPassword(): string {
  return randomBytes(9).toString("base64url");
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

export function familyCode(): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += CODE_CHARS[randomInt(CODE_CHARS.length)];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

export function shortCode(n = 4): string {
  let s = "";
  for (let i = 0; i < n; i++) s += CODE_CHARS[randomInt(CODE_CHARS.length)];
  return s;
}
