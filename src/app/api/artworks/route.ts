import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { todayIn } from "@/lib/dates";
import { ALLOWED, isDiscipline, sniff } from "@/lib/studio";

export const dynamic = "force-dynamic";

/** A student hands in a piece of work: an upload (photo, audio, video) and/or written text. */
export async function POST(req: Request) {
  const user = await getUser();
  if (!user || user.role !== "STUDENT" || !user.school) return Response.json({ error: "Sign in as a student to hand in work." }, { status: 401 });
  const origin = req.headers.get("origin");
  const hosts = [req.headers.get("x-forwarded-host"), req.headers.get("host")].filter(Boolean);
  if (origin && !hosts.includes(new URL(origin).host)) return Response.json({ error: "Forbidden" }, { status: 403 });

  let form: FormData;
  try { form = await req.formData(); } catch { return Response.json({ error: "That upload didn't come through. Try a smaller file." }, { status: 400 }); }
  const discipline = String(form.get("discipline") ?? "");
  const title = String(form.get("title") ?? "").trim().slice(0, 120);
  const reflection = String(form.get("reflection") ?? "").trim().slice(0, 600);
  const prompt = String(form.get("prompt") ?? "").trim().slice(0, 400);
  const textBody = String(form.get("textBody") ?? "").trim().slice(0, 8000);
  const file = form.get("file");
  const hasFile = file instanceof File && file.size > 0;

  if (!isDiscipline(discipline)) return Response.json({ error: "Choose what kind of work it is." }, { status: 400 });
  if (!title) return Response.json({ error: "Give your work a title." }, { status: 400 });
  if (!hasFile && !textBody) return Response.json({ error: "Add a photo, recording or video, or write your piece in the box." }, { status: 400 });

  let fileId: string | undefined;
  if (hasFile) {
    const rule = ALLOWED[file.type];
    if (!rule) return Response.json({ error: "That file type isn't supported. Use a photo (JPG, PNG), audio (MP3, M4A, WAV) or video (MP4, MOV)." }, { status: 400 });
    if (file.size > rule.maxMb * 1024 * 1024) return Response.json({ error: `That file is too big. ${rule.kind === "video" ? "Videos" : rule.kind === "audio" ? "Recordings" : "Photos"} can be up to ${rule.maxMb} MB.` }, { status: 400 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!sniff(file.type, bytes)) return Response.json({ error: "That file doesn't look like the type it says it is. Try saving it again." }, { status: 400 });
    const f = await db.artFile.create({ data: { schoolId: user.school.id, studentId: user.id, mime: file.type, size: file.size, data: Buffer.from(bytes) }, select: { id: true } });
    fileId = f.id;
  }

  const art = await db.artwork.create({
    data: { schoolId: user.school.id, studentId: user.id, discipline, title, reflection, prompt, textBody, fileId },
    select: { id: true },
  });
  const date = todayIn(user.school.timezone);
  await db.dailyLog.upsert({
    where: { studentId_date: { studentId: user.id, date } },
    create: { studentId: user.id, date, artsDone: true },
    update: { artsDone: true },
  });
  return Response.json({ ok: true, id: art.id });
}
