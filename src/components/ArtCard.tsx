import type { ArtFeedback, Artwork, ArtFile, User } from "@prisma/client";
import { DISCIPLINES, mediaKind } from "@/lib/studio";
import { fmtStamp } from "@/lib/dates";
import { addFeedback, deleteArtwork, toggleFeatured } from "@/app/studio/actions";

type Art = Artwork & { file: Pick<ArtFile, "id" | "mime"> | null; feedback: (ArtFeedback & { author: Pick<User, "firstName" | "lastName"> })[] };

/** One portfolio piece: the media or text, the student's reflection, and coach feedback. */
export function ArtCard({ art, tz, canFeature, canDelete, canGiveFeedback, returnTo, studentName }: {
  art: Art; tz: string; canFeature: boolean; canDelete: boolean; canGiveFeedback: boolean; returnTo: string; studentName?: string;
}) {
  const kind = art.file ? mediaKind(art.file.mime) : null;
  const src = art.file ? `/api/files/${art.file.id}` : "";
  return (
    <article className="card" style={{ gap: 10, alignContent: "start" }}>
      {kind === "image" && <img src={src} alt={art.title} loading="lazy" style={{ width: "100%", borderRadius: 8, maxHeight: 360, objectFit: "contain", background: "var(--sunk)" }} />}
      {kind === "audio" && <audio controls preload="metadata" src={src} style={{ width: "100%" }} />}
      {kind === "video" && <video controls preload="metadata" src={src} style={{ width: "100%", borderRadius: 8, maxHeight: 360, background: "#000" }} />}
      {art.textBody && <blockquote style={{ margin: 0, padding: "10px 14px", borderLeft: "3px solid var(--accent)", background: "var(--paper)", borderRadius: 6, whiteSpace: "pre-wrap", maxHeight: 260, overflow: "auto" }}>{art.textBody}</blockquote>}
      <div className="spread" style={{ alignItems: "baseline" }}>
        <h3 style={{ fontSize: "1.02rem" }}>{art.featured && <span title="Starred" aria-label="Starred">★ </span>}{art.title}</h3>
        <span className="chip">{DISCIPLINES[art.discipline]}</span>
      </div>
      <p className="small muted">{studentName ? `${studentName} · ` : ""}{fmtStamp(art.createdAt, tz, { month: "short", day: "numeric", year: "numeric" })}</p>
      {art.prompt && <p className="small muted">Prompt: {art.prompt}</p>}
      {art.reflection && <p className="small"><b>What I tried:</b> {art.reflection}</p>}
      {art.feedback.length > 0 && (
        <div className="stack" style={{ gap: 6 }}>{art.feedback.map(f => (
          <p key={f.id} className="small" style={{ padding: "8px 10px", background: "var(--accent-soft)", borderRadius: 8 }}><b>{f.author.firstName}:</b> {f.body}</p>
        ))}</div>
      )}
      {canGiveFeedback && (
        <form action={addFeedback} className="stack" style={{ gap: 6 }}>
          <input type="hidden" name="id" value={art.id} /><input type="hidden" name="returnTo" value={returnTo} />
          <label className="field small">Feedback<input id={`fb-${art.id}`} name="body" type="text" maxLength={1000} placeholder="One thing that works, one thing to try next" required /></label>
          <div><button className="btn small">Save feedback</button></div>
        </form>
      )}
      {(canFeature || canDelete) && (
        <div className="row" style={{ gap: 6 }}>
          {canFeature && <form action={toggleFeatured}><input type="hidden" name="id" value={art.id} /><input type="hidden" name="returnTo" value={returnTo} /><button className="btn small">{art.featured ? "Unstar" : "★ Star as best work"}</button></form>}
          {canDelete && <form action={deleteArtwork}><input type="hidden" name="id" value={art.id} /><input type="hidden" name="returnTo" value={returnTo} /><button className="btn small danger">Remove</button></form>}
        </div>
      )}
    </article>
  );
}
