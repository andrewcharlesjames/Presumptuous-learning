import { getUser } from "@/lib/auth";
import { canViewStudent } from "@/lib/access";
import { db } from "@/lib/db";
import { ALLOWED } from "@/lib/studio";

export const dynamic = "force-dynamic";

/** Serves an uploaded file to people allowed to see that student's work. Supports byte ranges for audio and video. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return new Response("Sign in first.", { status: 401 });
  const meta = await db.artFile.findUnique({ where: { id }, select: { studentId: true, mime: true, size: true } });
  if (!meta || !ALLOWED[meta.mime] || !(await canViewStudent(user, meta.studentId))) return new Response("Not found", { status: 404 });
  const file = await db.artFile.findUnique({ where: { id }, select: { data: true } });
  if (!file) return new Response("Not found", { status: 404 });
  const data = new Uint8Array(file.data);
  const headers: Record<string, string> = {
    "Content-Type": meta.mime,
    "Content-Disposition": "inline",
    "Cache-Control": "private, max-age=3600",
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : data.length - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : data.length - 1;
    start = Math.max(0, start); end = Math.min(end, data.length - 1);
    if (start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${data.length}` } });
    return new Response(data.slice(start, end + 1), { status: 206, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${data.length}`, "Content-Length": String(end - start + 1) } });
  }
  return new Response(data, { headers: { ...headers, "Content-Length": String(data.length) } });
}
