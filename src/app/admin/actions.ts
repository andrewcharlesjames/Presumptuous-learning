"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { setFlash } from "@/lib/flash";
import { tempPassword } from "@/lib/passwords";
import { createSchool, uniqueSchoolCode } from "@/lib/records";
import { createDemoSchool } from "@/lib/demo";

const schoolSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().max(12).optional(),
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  email: z.string().trim().email(),
});

export async function createSchoolAction(form: FormData) {
  await requireUser(["PLATFORM_ADMIN"]);
  const parsed = schoolSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    await setFlash({ tone: "error", text: "Fill in the school name and the admin's name and email." });
    redirect("/admin");
  }
  const d = parsed.data;
  if (await db.user.findUnique({ where: { email: d.email.toLowerCase() } })) {
    await setFlash({ tone: "error", text: `${d.email} already has an account. Use a different email for this school's admin.` });
    redirect("/admin");
  }
  const code = await uniqueSchoolCode(d.code || d.name);
  const password = tempPassword();
  await createSchool({ name: d.name, code, admin: { firstName: d.firstName, lastName: d.lastName, email: d.email, password } });
  await setFlash({
    tone: "ok", text: `${d.name} is ready. Send these sign-in details to ${d.firstName}.`,
    secret: [{ label: "School code", value: code }, { label: "Admin email", value: d.email.toLowerCase() }, { label: "Temporary password", value: password }],
  });
  revalidatePath("/admin");
  redirect("/admin");
}

export async function createDemoAction() {
  await requireUser(["PLATFORM_ADMIN"]);
  const { school, logins } = await createDemoSchool();
  await setFlash({ tone: "ok", text: `Created ${school.name} with sample students, classes, assessments and attendance.`, secret: logins });
  revalidatePath("/admin");
  redirect("/admin");
}

export async function deleteDemoAction(form: FormData) {
  await requireUser(["PLATFORM_ADMIN"]);
  const id = String(form.get("id") ?? "");
  const school = await db.school.findUnique({ where: { id } });
  if (school?.isDemo) {
    await db.school.delete({ where: { id } });
    await setFlash({ tone: "ok", text: `Deleted ${school.name}.` });
  }
  revalidatePath("/admin");
  redirect("/admin");
}
