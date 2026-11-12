// Runs once when the server starts. Checks every 30 minutes whether any school has reached
// Friday afternoon and sends that week's parent emails (each parent at most once a week).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.WEEKLY_EMAIL === "off") return;
  const { runWeekly } = await import("./lib/weekly");
  const tick = () => runWeekly().then(r => { if (r.sent || r.failed) console.log(`[weekly email] sent ${r.sent}, failed ${r.failed}`); }).catch(e => console.error("[weekly email]", e));
  setTimeout(tick, 60_000); // let the app finish starting
  setInterval(tick, 30 * 60_000).unref();
}
