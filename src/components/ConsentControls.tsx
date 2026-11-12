import type { ConsentState } from "@/lib/consent";
import { setConsent } from "@/app/privacy-actions/actions";

const label = (v: boolean | null) => (v === true ? "Given" : v === false ? "Withdrawn" : "Not given yet");
const tone = (v: boolean | null) => (v === true ? "above" : v === false ? "below" : "none");

/** Platform and AI consent for one student, with give / withdraw buttons. */
export function ConsentControls({ studentId, state, returnTo, recording }: { studentId: string; state: ConsentState; returnTo: string; recording?: boolean }) {
  const row = (kind: "PLATFORM" | "AI", title: string, help: string, v: boolean | null, by?: string) => (
    <div className="stack" style={{ gap: 4 }}>
      <div className="row" style={{ gap: 8 }}><b className="small">{title}</b><span className={`pill ${tone(v)}`}>{label(v)}</span>{by && <span className="small muted">{by}</span>}</div>
      <p className="small muted">{help}</p>
      <form action={setConsent}>
        <input type="hidden" name="studentId" value={studentId} /><input type="hidden" name="kind" value={kind} /><input type="hidden" name="returnTo" value={returnTo} />
        <input type="hidden" name="granted" value={String(v !== true)} />
        <button className={`btn small ${v !== true ? "primary" : ""}`}>{v === true ? (recording ? "Record withdrawal" : "Withdraw consent") : (recording ? "Record paper consent" : "Give consent")}</button>
      </form>
    </div>
  );
  return (
    <div className="stack" style={{ gap: 12 }}>
      {row("PLATFORM", "Using the platform", "Storing learning records: assessments, plans, practice, check-ins, attendance, portfolio and projects.", state.platform, state.platformBy)}
      {row("AI", "AI features", "The AI tutor and project idea suggestions send the student's answers or writing (never their name) to Anthropic's Claude AI to generate a response.", state.ai, state.aiBy)}
    </div>
  );
}
