"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSchoolUser } from "@/lib/auth";
import { canManageStudent } from "@/lib/access";
import { db } from "@/lib/db";
import { setFlash } from "@/lib/flash";

const back = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "/");
  return s.startsWith("/") && !s.startsWith("//") ? s : "/";
};

/** Students star their own best work; staff can too. */
export async function toggleFeatured(form: FormData) {
  const { user } = await requireSchoolUser(["STUDENT", "COACH", "SCHOOL_ADMIN"]);
  const id = String(form.get("id") ?? "");
  const returnTo = back(form.get("returnTo"));
  const art = await db.artwork.findUnique({ where: { id } });
  if (art && (art.studentId === user.id || await canManageStudent(user, art.studentId))) {
    await db.artwork.update({ where: { id }, data: { featured: !art.featured } });
  }
  revalidatePath(returnTo);
  redirect(returnTo);
}

export async function deleteArtwork(form: FormData) {
  const { user } = await requireSchoolUser(["STUDENT", "COACH", "SCHOOL_ADMIN"]);
  const id = String(form.get("id") ?? "");
  const returnTo = back(form.get("returnTo"));
  const art = await db.artwork.findUnique({ where: { id } });
  if (art && (art.studentId === user.id || await canManageStudent(user, art.studentId))) {
    await db.artwork.delete({ where: { id } });
    if (art.fileId) await db.artFile.delete({ where: { id: art.fileId } }).catch(() => {});
    await setFlash({ tone: "ok", text: `Removed “${art.title}”.` });
  }
  revalidatePath(returnTo);
  redirect(returnTo);
}

export async function addFeedback(form: FormData) {
  const { user } = await requireSchoolUser(["COACH", "SCHOOL_ADMIN"]);
  const id = String(form.get("id") ?? "");
  const body = String(form.get("body") ?? "").trim().slice(0, 1000);
  const returnTo = back(form.get("returnTo"));
  const art = await db.artwork.findUnique({ where: { id } });
  if (art && body && await canManageStudent(user, art.studentId)) {
    await db.artFeedback.create({ data: { artworkId: id, authorId: user.id, body } });
    await setFlash({ tone: "ok", text: "Feedback saved. The student and their family can see it." });
  }
  revalidatePath(returnTo);
  redirect(returnTo);
}
