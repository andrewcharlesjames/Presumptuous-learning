// Runs on every start (after migrations). Safe to run repeatedly.
// - Creates the first platform admin from ADMIN_EMAIL / ADMIN_PASSWORD if no platform admin exists yet.
// - Recovery: with ADMIN_RESET_PASSWORD=yes, sets the password of the platform admin ADMIN_EMAIL to
//   ADMIN_PASSWORD (creating that admin if it doesn't exist), re-activates it and signs it out everywhere.
//   Remove ADMIN_RESET_PASSWORD afterwards, or it resets on every deploy.
import { PrismaClient } from "@prisma/client";
import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb);
const db = new PrismaClient();

async function hash(password) {
  const salt = randomBytes(16);
  const h = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${h.toString("base64")}`;
}

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD?.trim();
  const reset = ["yes", "true", "1"].includes((process.env.ADMIN_RESET_PASSWORD ?? "").trim().toLowerCase());
  const admins = await db.user.findMany({ where: { role: "PLATFORM_ADMIN" }, select: { email: true, active: true } });
  console.log(`bootstrap: platform admins: ${admins.map(a => `${a.email}${a.active ? "" : " (inactive)"}`).join(", ") || "none"}`);

  if (!reset && admins.length > 0) return console.log("bootstrap: platform admin exists (ADMIN_PASSWORD is only used for the first admin; set ADMIN_RESET_PASSWORD=yes to reset it)");
  if (!email || !password) return console.warn("bootstrap: set ADMIN_EMAIL and ADMIN_PASSWORD");
  if (password.length < 12) return console.warn("bootstrap: ADMIN_PASSWORD must be at least 12 characters; nothing changed");

  const user = await db.user.findUnique({ where: { email } });
  if (user && user.role !== "PLATFORM_ADMIN") return console.warn(`bootstrap: ${email} belongs to a ${user.role} account, not a platform admin; nothing changed`);
  if (user) {
    await db.user.update({ where: { id: user.id }, data: { passwordHash: await hash(password), active: true } });
    await db.session.deleteMany({ where: { userId: user.id } });
    return console.log(`bootstrap: reset the password for platform admin ${email}. Now remove ADMIN_RESET_PASSWORD from Railway.`);
  }
  await db.user.create({
    data: { role: "PLATFORM_ADMIN", email, firstName: process.env.ADMIN_FIRST_NAME || "Platform", lastName: process.env.ADMIN_LAST_NAME || "Admin", passwordHash: await hash(password) },
  });
  console.log(`bootstrap: created platform admin ${email}`);
}

main()
  .catch(e => { console.error("bootstrap failed", e); process.exitCode = 1; })
  .finally(() => db.$disconnect());
