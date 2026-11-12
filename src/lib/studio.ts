// Studio and portfolio: disciplines, allowed uploads, and prompts that connect art to what the student is learning.

export const DISCIPLINES = {
  VISUAL_ARTS: "Visual arts",
  MUSIC: "Music",
  DRAMA: "Drama",
  DANCE: "Dance",
  MEDIA_ARTS: "Media arts",
  WRITING: "Writing",
} as const;
export type DisciplineName = keyof typeof DISCIPLINES;
export const isDiscipline = (x: string): x is DisciplineName => x in DISCIPLINES;

/** File types accepted, with size caps. SVG and HTML are never accepted (they can carry scripts). */
export const ALLOWED: Record<string, { kind: "image" | "audio" | "video"; maxMb: number }> = {
  "image/jpeg": { kind: "image", maxMb: 8 },
  "image/png": { kind: "image", maxMb: 8 },
  "image/webp": { kind: "image", maxMb: 8 },
  "image/gif": { kind: "image", maxMb: 8 },
  "image/heic": { kind: "image", maxMb: 8 },
  "audio/mpeg": { kind: "audio", maxMb: 15 },
  "audio/mp4": { kind: "audio", maxMb: 15 },
  "audio/x-m4a": { kind: "audio", maxMb: 15 },
  "audio/wav": { kind: "audio", maxMb: 15 },
  "audio/webm": { kind: "audio", maxMb: 15 },
  "audio/ogg": { kind: "audio", maxMb: 15 },
  "video/mp4": { kind: "video", maxMb: 25 },
  "video/quicktime": { kind: "video", maxMb: 25 },
  "video/webm": { kind: "video", maxMb: 25 },
};
export const ACCEPT_ATTR = Object.keys(ALLOWED).join(",");
export const mediaKind = (mime: string) => ALLOWED[mime]?.kind ?? null;

/** A prompt that turns a skill the student is learning into a creative piece. */
export function crossoverPrompt(skill: string, grade: number): string {
  return grade <= 5
    ? `Make a picture, song or short play that shows ${skill.toLowerCase()}. Then teach it to someone at home.`
    : `Create a comic, a 60-second video script, a song verse or an infographic that teaches ${skill.toLowerCase()} to a younger student.`;
}

/** Check a file's first bytes match its claimed type (so a renamed file can't pose as an image). */
export function sniff(mime: string, b: Uint8Array): boolean {
  const at = (i: number, ...v: number[]) => v.every((x, k) => b[i + k] === x);
  const ascii = (i: number, s: string) => [...s].every((c, k) => b[i + k] === c.charCodeAt(0));
  switch (mime) {
    case "image/jpeg": return at(0, 0xff, 0xd8, 0xff);
    case "image/png": return at(0, 0x89, 0x50, 0x4e, 0x47);
    case "image/gif": return ascii(0, "GIF8");
    case "image/webp": return ascii(0, "RIFF") && ascii(8, "WEBP");
    case "image/heic": case "audio/mp4": case "audio/x-m4a": case "video/mp4": case "video/quicktime": return ascii(4, "ftyp");
    case "audio/mpeg": return ascii(0, "ID3") || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0);
    case "audio/wav": return ascii(0, "RIFF") && ascii(8, "WAVE");
    case "audio/webm": case "video/webm": return at(0, 0x1a, 0x45, 0xdf, 0xa3);
    case "audio/ogg": return ascii(0, "OggS");
    default: return false;
  }
}
