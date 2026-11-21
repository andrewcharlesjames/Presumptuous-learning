// Runs once when the server starts. Every 30 minutes: makes each student's list for the week
// (first thing Monday), and once a school reaches Friday afternoon, sends that week's parent emails
// (each parent at most once a week).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.WEEKLY_EMAIL === "off") return;
  const { runWeekly } = await import("./lib/weekly");
  const { prepareWeeks } = await import("./lib/week");
  const tick = async () => {
    await prepareWeeks().then(n => { if (n) console.log(`[week] prepared ${n} weekly lists`); }).catch(e => console.error("[week]", e));
    await runWeekly().then(r => { if (r.sent || r.failed) console.log(`[weekly email] sent ${r.sent}, failed ${r.failed}`); }).catch(e => console.error("[weekly email]", e));
  };
  setTimeout(tick, 60_000); // let the app finish starting
  setInterval(tick, 30 * 60_000).unref();
}
