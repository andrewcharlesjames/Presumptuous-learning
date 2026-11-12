// Runs on every start (after migrations). Creates the first platform admin from
// ADMIN_EMAIL / ADMIN_PASSWORD if no platform admin exists yet. Safe to run repeatedly.
import { PrismaClient } from "@prisma/client";
import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb);
const db = new PrismaClient();

async function main() {
  const existing = await db.user.count({ where: { role: "PLATFORM_ADMIN" } });
  if (existing > 0) return console.log("bootstrap: platform admin exists");
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return console.warn("bootstrap: set ADMIN_EMAIL and ADMIN_PASSWORD to create the first platform admin");
  if (password.length < 12) return console.warn("bootstrap: ADMIN_PASSWORD must be at least 12 characters; admin not created");
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  await db.user.create({
    data: {
      role: "PLATFORM_ADMIN",
      email,
      firstName: process.env.ADMIN_FIRST_NAME || "Platform",
      lastName: process.env.ADMIN_LAST_NAME || "Admin",
      passwordHash: `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`,
    },
  });
  console.log(`bootstrap: created platform admin ${email}`);
}

main()
  .catch(e => { console.error("bootstrap failed", e); process.exitCode = 1; })
  .finally(() => db.$disconnect());
