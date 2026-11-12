"use client";
import { Info } from "@/components/Info";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const DISCIPLINES = [["VISUAL_ARTS", "Visual arts"], ["MUSIC", "Music"], ["DRAMA", "Drama"], ["DANCE", "Dance"], ["MEDIA_ARTS", "Media arts"], ["WRITING", "Writing"]] as const;

/** Hand in a piece: pick the prompt, the kind of work, a file and/or text, a title and a reflection. */
export function SubmitArt({ prompts, accept }: { prompts: string[]; accept: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      const res = await fetch("/api/artworks", { method: "POST", body: new FormData(e.currentTarget) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error ?? "That didn't save. Try again."); return; }
      formRef.current?.reset();
      router.refresh();
    } catch {
      setError("That didn't save. Check your connection and try again.");
    } finally { setBusy(false); }
  };
  return (
    <form ref={formRef} onSubmit={submit} className="card">
      <h2>Hand in your work<Info label="Handing in">{"Pick the kind of art, give it a title, then add a file or type your writing. Say what you tried and what you'd change next time. Photos up to 8 MB, audio 15 MB, video 25 MB."}</Info></h2>
      <label className="field">Which prompt?<select id="art-prompt" name="prompt">
        {prompts.map(p => <option key={p} value={p}>{p.length > 110 ? p.slice(0, 110) + "…" : p}</option>)}
        <option value="">My own idea</option>
      </select></label>
      <div className="form-grid">
        <label className="field">What kind of work<select id="art-discipline" name="discipline" defaultValue="VISUAL_ARTS">{DISCIPLINES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label className="field">Title<input id="art-title" name="title" type="text" maxLength={120} required /></label>
      </div>
      <label className="field">Photo, recording or video<span className="hint">Photos up to 8 MB, recordings 15 MB, videos 25 MB. On a phone this can open the camera.</span>
        <input id="art-file" name="file" type="file" accept={accept} /></label>
      <label className="field">Or write it here<span className="hint">A poem, script, song lyrics or story</span>
        <textarea id="art-text" name="textBody" maxLength={8000} style={{ fontFamily: "inherit", fontSize: ".95rem", minHeight: 100 }} /></label>
      <label className="field">What I tried<span className="hint">One or two sentences about your choices</span><input id="art-reflection" name="reflection" type="text" maxLength={600} /></label>
      {error && <p className="flash error" role="alert">{error}</p>}
      <div><button className="btn primary" disabled={busy}>{busy ? "Uploading…" : "Hand it in"}</button></div>
    </form>
  );
}
