// End-to-end walk-through of every role against a running server.
// Usage: BASE=http://localhost:3100 ADMIN_EMAIL=... ADMIN_PASSWORD=... SHOTS=/path node tests/e2e.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright"); // uses the machine-wide Playwright (NODE_PATH)

const BASE = process.env.BASE ?? "http://localhost:3100";
const SHOTS = process.env.SHOTS;
const problems = [];
const ok = (cond, msg) => { if (!cond) problems.push(msg); console.log(`${cond ? "✓" : "✗"} ${msg}`); };

const browser = await chromium.launch();

async function session(name) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", e => problems.push(`[${name}] page error: ${e.message}`));
  page.on("console", m => { if (m.type() === "error" && !m.text().includes("404 (Not Found)") && !m.text().includes("400 (Bad Request)")) problems.push(`[${name}] console: ${m.text()}`); });
  page.on("response", r => { if (r.status() >= 500) problems.push(`[${name}] ${r.status()} ${r.url()}`); });
  return { ctx, page };
}
async function shot(page, file, full = true) { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${file}.png`, fullPage: full }); }
async function secrets(page, expect) {
  const out = {};
  await page.waitForSelector(`.flash:has-text("${expect}") .secret`, { timeout: 30000 }).catch(() => {});
  for (const el of await page.locator(".secret").all()) {
    const label = (await el.innerText()).split(":")[0].trim();
    out[label] = (await el.locator("code").innerText()).trim();
  }
  return out;
}
async function flashText(page, expect) {
  await page.waitForSelector(`.flash:has-text("${expect}")`, { timeout: 30000 }).catch(() => {});
  return page.locator(".flash").first().innerText().catch(() => "");
}
async function adultLogin(page, email, password) {
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click("button:has-text('Sign in')");
  await page.waitForLoadState("networkidle");
}
async function visit(page, path, name) {
  const r = await page.goto(`${BASE}${path}`);
  ok(r.status() < 400, `${name}: ${path} → ${r.status()}`);
}

/* 1. platform admin */
const A = await session("admin");
await adultLogin(A.page, process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);
ok(A.page.url().endsWith("/admin"), "platform admin lands on /admin");
await A.page.click("button:has-text('Create a demo school')");
await A.page.waitForLoadState("networkidle");
const demo = await secrets(A.page, "Created Riverside");
ok(!!demo["School code"], `demo school created (${demo["School code"]})`);
await A.page.fill("#name", "Maple Grove School");
await A.page.fill("#firstName", "Test");
await A.page.fill("#lastName", "Principal");
await A.page.fill("#email", `principal.${Date.now()}@example.com`);
await A.page.click("button:has-text('Create school')");
await A.page.waitForSelector("text=Maple Grove School is ready", { timeout: 30000 });
const real = await secrets(A.page, "Maple Grove");
ok(!!real["Temporary password"], "real school created with temporary admin password");
await shot(A.page, "01-admin");
await A.page.goto(`${BASE}/admin/questions?subject=math&grade=5`);
ok(await A.page.locator("h1:has-text('Question bank')").count() === 1, "question bank opens");
await shot(A.page, "17-question-bank");
await A.page.locator("a:has-text('Edit')").first().click();
await A.page.waitForURL(/\/admin\/questions\/.+/);
await A.page.fill("#explanation", "Line up the decimal points, then add.");
await A.page.click("button:has-text('Save question')");
await A.page.waitForSelector(".flash:has-text('Question saved')", { timeout: 15000 });
ok(true, "admin edits a question");

/* 2. demo principal: every school page */
const [pEmail, pPw] = demo["Principal (school admin)"].split(" / ");
const P = await session("principal");
await adultLogin(P.page, pEmail, pPw);
ok(P.page.url().endsWith("/school"), "school admin lands on /school");
await shot(P.page, "02-school-overview");
for (const p of ["/school/people", "/school/classes", "/school/schedule", "/school/calendar", "/school/settings"]) await visit(P.page, p, "principal");
await P.page.goto(`${BASE}/school/people`); await shot(P.page, "03-people");
await P.page.goto(`${BASE}/school/calendar`); await shot(P.page, "04-calendar");
await P.page.goto(`${BASE}/school/schedule`); await shot(P.page, "05-schedule");
await P.page.goto(`${BASE}/school/classes`);
await P.page.click("table a >> nth=0");
await P.page.waitForLoadState("networkidle");
ok(/\/school\/classes\/.+/.test(P.page.url()), "class edit page opens");

/* 3. real school: admin adds a coach, a student, a class */
const R = await session("realadmin");
await adultLogin(R.page, real["Admin email"], real["Temporary password"]);
await R.page.goto(`${BASE}/school/people`);
await R.page.fill("#t-first", "Casey"); await R.page.fill("#t-last", "Coach"); await R.page.fill("#t-email", `casey.${Date.now()}@example.com`);
await R.page.click("button:has-text('Add') >> nth=-1");
await R.page.waitForLoadState("networkidle");
const coach = await secrets(R.page, "Added Casey");
ok(!!coach["Temporary password"], "coach added");
await R.page.fill("#s-first", "Jordan"); await R.page.fill("#s-last", "Lee");
await R.page.selectOption("#s-grade", "4");
await R.page.click("button:has-text('Add student')");
await R.page.waitForLoadState("networkidle");
const stu = await secrets(R.page, "Added Jordan");
ok(!!stu["Username"] && !!stu["Family code for parents"], `student added (${stu["Username"]})`);
await R.page.fill("#csv", "first_name,last_name,grade\nRiley,Ng,K\nSam,Ortiz,12\nBad,Row,15");
await R.page.click("button:has-text('Import students')");
await R.page.waitForLoadState("networkidle");
ok((await flashText(R.page, "Imported")).includes("Imported 2"), "CSV import adds valid rows and skips bad ones");
await R.page.goto(`${BASE}/school/classes`);
await R.page.fill("#c-name", "Studio 4"); await R.page.check("#g-4");
await R.page.click("button:has-text('Create class')");
await R.page.waitForLoadState("networkidle");
await R.page.locator("input[name=coach]").first().check();
await R.page.locator("input[name=student]").first().check();
await R.page.click("button:has-text('Save class')");
await R.page.waitForLoadState("networkidle");
ok((await flashText(R.page, "Saved Studio")).includes("1 student"), "class saved with coach and student");
const classUrl = R.page.url();
// schedule edit: bad overlap is rejected
await R.page.goto(`${BASE}/school/schedule`);
await R.page.fill("#start-1", "09:15");
await R.page.click("button:has-text('Save school day')");
await R.page.waitForLoadState("networkidle");
ok((await flashText(R.page, "overlaps")).includes("overlaps"), "overlapping timetable is rejected");

/* 4. coach takes attendance */
const C = await session("coach");
await adultLogin(C.page, coach["Email"], coach["Temporary password"]);
ok(C.page.url().endsWith("/coach"), "coach lands on /coach");
await C.page.click(".card >> nth=0");
await C.page.waitForLoadState("networkidle");
await C.page.click("button:has-text('Save attendance')");
await C.page.waitForLoadState("networkidle");
ok((await flashText(C.page, "Attendance saved")).includes("Attendance saved"), "coach saves attendance");
await shot(C.page, "06-coach-class");

/* 5. student takes the assessment */
const S = await session("student");
await S.page.goto(`${BASE}/login`);
await S.page.click("button:has-text('Student')");
await S.page.fill("#code", real["School code"]); await S.page.fill("#username", stu["Username"]); await S.page.fill("#spassword", stu["Password"]);
await S.page.click("button:has-text('Sign in')");
await S.page.waitForLoadState("networkidle");
ok(S.page.url().endsWith("/student"), "student lands on Today");
await shot(S.page, "07-student-today-before");
await S.page.click("button:has-text('Start the assessment')");
await S.page.waitForURL(/\/student\/assessment/);
let count = 0;
// Answer by pattern: strong in the first subjects (always the correct-looking first try won't work, so pick by index).
while (!/\/students\//.test(S.page.url()) && count < 150) {
  const opts = S.page.locator(".opt");
  try { await opts.first().waitFor({ timeout: 10000 }); } catch { break; }
  if (count === 3) await shot(S.page, "08-quiz", false);
  await opts.nth(count % 5).click();
  await S.page.locator("button.primary:has-text('Next')").click();
  await S.page.waitForFunction(n => document.querySelector(".qtext")?.getAttribute("data-n") !== n || /\/students\//.test(location.href), String(count), { timeout: 15000 }).catch(() => {});
  count++;
}
await S.page.waitForURL(/\/students\//, { timeout: 20000 });
ok(count >= 7 * 6 && count <= 7 * 12, `adaptive assessment asked ${count} questions (between 6 and 12 per subject)`);
ok(await S.page.locator("text=working at").count() > 0, "results show the level each subject is working at");
await shot(S.page, "09-student-results");
for (const t of ["This month", "This year"]) { await S.page.click(`button.tab:has-text('${t}')`); }
await shot(S.page, "10-year-plan");
await S.page.goto(`${BASE}/student`);
await shot(S.page, "11-student-today-after");
// lessons and mastery: seed a sample lesson (the AI writes real ones), then fail once and pass once
{
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const learnLinks = S.page.locator("a:has-text('Learn it')");
  ok(await learnLinks.count() > 0, "Today plan has Learn it buttons");
  const hrefs = [];
  for (let i = 0; i < Math.min(2, await learnLinks.count()); i++) hrefs.push(await learnLinks.nth(i).getAttribute("href"));
  const seed = async href => {
    const u = new URL(href, BASE);
    const subject = u.searchParams.get("subject"), grade = Number(u.searchParams.get("grade")), skill = u.searchParams.get("skill");
    const q = n => ({ prompt: `Sample check question ${n} about ${skill}?`, correct: `Right answer ${n}`, wrong: [`Wrong A${n}`, `Wrong B${n}`, `Wrong C${n}`], explanation: "Sample explanation." });
    const content = { title: skill, whyItMatters: "Sample reason.", explanation: ["Sample explanation paragraph."], examples: [{ problem: "Sample problem", steps: ["Step one", "Step two"], answer: "Sample answer" }], commonMistake: "Sample mistake.", tryIt: q(0), checkQuestions: [1, 2, 3, 4, 5].map(q) };
    const lesson = await prisma.lesson.upsert({ where: { subject_grade_skill_variant: { subject, grade, skill, variant: 1 } }, create: { subject, grade, skill, variant: 1, content }, update: { content, active: true } });
    await prisma.question.deleteMany({ where: { key: { startsWith: `lesson-${lesson.id}-` } } });
    await prisma.question.createMany({ data: content.checkQuestions.map((c, n) => ({ key: `lesson-${lesson.id}-${n}`, subject, grade, strand: "Sample", skill, prompt: c.prompt, correct: c.correct, wrong1: c.wrong[0], wrong2: c.wrong[1], wrong3: c.wrong[2], explanation: c.explanation, active: false, source: "lesson" })) });
  };
  const runCheck = async right => {
    await S.page.click("button:has-text('Start the check')");
    await S.page.waitForURL(/\/student\/practice\//);
    for (let i = 0; i < 5; i++) {
      const opt = right ? S.page.locator(".opt:has-text('Right answer')") : S.page.locator(".opt:has-text('Wrong A')");
      await opt.first().click();
      await S.page.click("button:has-text('Check')");
      await S.page.waitForSelector(".flash[role=status]");
      await S.page.click("button.primary");
    }
    await S.page.waitForSelector("h2:has-text('Mastered'), h2:has-text('Not yet')", { timeout: 15000 });
  };
  await seed(hrefs[0]);
  await S.page.goto(`${BASE}${hrefs[0]}`);
  ok(await S.page.locator("text=Worked example 1").count() === 1, "lesson shows worked examples");
  await S.page.locator(".opt:has-text('Right answer 0')").click();
  ok(await S.page.locator("text=Yes, that's it.").count() === 1, "try-it question gives instant feedback");
  await shot(S.page, "18-lesson");
  await runCheck(false);
  ok(await S.page.locator("h2:has-text('Not yet')").count() === 1, "missing the check says Not yet");
  await S.page.click("a:has-text('Learn it another way')");
  await S.page.waitForURL(/\/student\/learn/);
  ok(await S.page.locator("text=Last check: 0 of 5").count() === 1, "reteach page shows the last check and asks for a new lesson");
  if (hrefs[1]) {
    await seed(hrefs[1]);
    await S.page.goto(`${BASE}${hrefs[1]}`);
    await runCheck(true);
    ok(await S.page.locator("h2:has-text('Mastered')").count() === 1, "passing the check masters the skill");
    await shot(S.page, "19-mastered", false);
    await S.page.goto(`${BASE}/student`);
    const stillThere = await S.page.locator(`a[href="${hrefs[1]}"]`).count();
    ok(stillThere === 0, "mastered skill leaves the Today plan");
  }
  await prisma.$disconnect();
}
// practice set
const practiceButtons = S.page.locator("button:has-text('Practice now')");
ok(await practiceButtons.count() > 0, "Today plan has Practice now buttons");
await practiceButtons.first().click();
await S.page.waitForURL(/\/student\/practice\//);
for (let i = 0; i < 5; i++) {
  await S.page.locator(".opt").first().click();
  await S.page.click("button:has-text('Check')");
  await S.page.waitForSelector(".flash[role=status]");
  if (i === 0) await shot(S.page, "16-practice-feedback", false);
  const label = await S.page.locator("button.primary").innerText();
  await S.page.click("button.primary");
  if (/score/i.test(label)) break;
}
await S.page.waitForSelector("text=Set complete", { timeout: 15000 });
ok(true, "practice set completes with a score");
await S.page.goto(`${BASE}/student`);
const meLink = await S.page.locator("a:has-text('My plan')").getAttribute("href");
await S.page.goto(`${BASE}${meLink}`);
ok(await S.page.locator("text=Practice, last 7 days").count() > 0 && await S.page.locator("text=/\\d+ sets? ·/").count() > 0, "practice shows on the student's plan page");

/* 5b. the school day: check in, arts, reflect */
await S.page.goto(`${BASE}/student`);
const schoolDay = await S.page.locator("text=How are you feeling this morning?").count() > 0;
if (schoolDay) {
  await S.page.locator("label:has-text('Good')").first().click();
  await S.page.fill("#goal", "Master one new skill");
  await S.page.click("button:has-text('Check in')");
  await S.page.waitForSelector("text=Checked in", { timeout: 15000 });
  ok(true, "student checks in with a mood and a goal");
  await S.page.locator("form:has(input[name=kind][value=arts]) button").click();
  await S.page.waitForSelector("text=Arts", { timeout: 15000 });
  await S.page.fill("#learned", "How to check my work");
  await S.page.locator("label:has-text('Overreached')").click();
  await S.page.click("button:has-text('Save my reflection')");
  await S.page.waitForSelector("text=Reflected", { timeout: 15000 });
  const progress = await S.page.locator("h2:has-text('Today:')").innerText();
  ok(/[45] of 5 done/.test(progress), `day progress updates (${progress})`);
  ok(await S.page.locator("text=/1-day streak/").count() === 1, "completing check-in, learning and reflection starts a streak");
  await shot(S.page, "20-student-day");
  await C.page.goto(`${BASE}/coach`);
  await C.page.click(".card >> nth=0");
  await C.page.waitForLoadState("networkidle");
  ok(await C.page.locator("h2:has-text('Today in class')").count() === 1 && await C.page.locator("text=Master one new skill").count() === 1, "coach sees today's check-in and goal");
  await shot(C.page, "21-coach-today");
} else {
  ok(true, "(not a school day today: skipped check-in steps)");
}

/* 5c. coach tools: assign work, share a note */
await C.page.goto(`${BASE}/coach`);
await C.page.click(".card:has(h2) >> nth=0").catch(() => {});
await C.page.goto(C.page.url().includes("/coach/classes/") ? C.page.url() : `${BASE}/coach`);
if (!C.page.url().includes("/coach/classes/")) { await C.page.locator("a.card").first().click(); await C.page.waitForURL(/\/coach\/classes\//); }
await C.page.selectOption("#as-kind", "PRACTICE");
await C.page.fill("#as-note", "Do this before Friday");
await C.page.click("button:has-text('Assign')");
ok((await flashText(C.page, "Assigned to")).includes("Assigned to 1 student"), "coach assigns practice to the class");
ok(await C.page.locator("h2:has-text('Assignments')").count() === 1 && await C.page.locator("text=0/1").count() > 0, "class page lists the assignment with completion");
await shot(C.page, "23-coach-assignments");
await S.page.goto(`${BASE}/student`);
ok(await S.page.locator("h2:has-text('From your coach')").count() === 1 && await S.page.locator("text=Do this before Friday").count() === 1, "student sees the assignment on Today");
await S.page.locator("section:has(h2:has-text('From your coach')) button:has-text('Practice now')").first().click();
await S.page.waitForURL(/\/student\/practice\//);
for (let i = 0; i < 5; i++) {
  await S.page.locator(".opt").first().click();
  await S.page.click("button:has-text('Check')");
  await S.page.waitForSelector(".flash[role=status]");
  const label = await S.page.locator("button.primary").innerText();
  await S.page.click("button.primary");
  if (/score/i.test(label)) break;
}
await S.page.goto(`${BASE}/student`);
ok(await S.page.locator("section:has(h2:has-text('From your coach')) .pill:has-text('Done')").count() >= 1, "finishing the practice marks the assignment done");
const studentLink = await C.page.locator("table a[href^='/students/']").first().getAttribute("href");
await C.page.goto(`${BASE}${studentLink}`);
await C.page.fill("#note-body", "Great effort this week. Keep overreaching!");
await C.page.check("#note-shared");
await C.page.click("button:has-text('Save note')");
ok((await flashText(C.page, "Note saved")).includes("shared"), "coach saves a note shared with the family");
const assignBtns = C.page.locator("form:has(input[value=MASTER_SKILL]) button:has-text('Assign')");
if (await assignBtns.count() > 0) {
  await assignBtns.first().click();
  ok((await flashText(C.page, "Assigned to")).includes("1 student"), "coach assigns a next-level requirement in one click");
}
await shot(C.page, "24-student-profile-coach");

/* 5d. studio and portfolio */
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
await S.page.goto(`${BASE}/student/studio`);
ok(await S.page.locator("text=Today's creative prompt").count() === 1, "studio shows today's prompt");
await S.page.fill("#art-title", "Texture rubbings");
await S.page.setInputFiles("#art-file", { name: "rubbing.png", mimeType: "image/png", buffer: PNG });
await S.page.fill("#art-reflection", "I tried three different textures.");
await S.page.click("button:has-text('Hand it in')");
await S.page.waitForSelector("article:has-text('Texture rubbings') img", { timeout: 15000 });
ok(true, "student hands in a photo and it shows in recent work");
await S.page.selectOption("#art-discipline", "WRITING");
await S.page.fill("#art-title", "Snow poem");
await S.page.fill("#art-text", "Snow falls soft\non the quiet street.");
await S.page.click("button:has-text('Hand it in')");
await S.page.waitForSelector("article:has-text('Snow poem') blockquote", { timeout: 15000 });
ok(true, "student hands in a written piece");
await S.page.fill("#art-title", "Fake image");
await S.page.setInputFiles("#art-file", { name: "fake.png", mimeType: "image/png", buffer: Buffer.from("not really a picture") });
await S.page.click("button:has-text('Hand it in')");
{ const t = await S.page.waitForSelector("p[role=alert]", { timeout: 15000 }).then(e => e.innerText()); ok(t.includes("look like"), `a renamed non-image file is refused (${t})`); }
await S.page.locator("article:has-text('Snow poem') button:has-text('Star as best work')").click();
await S.page.waitForSelector("article:has-text('★ Snow poem')", { timeout: 15000 }).catch(() => {});
ok(await S.page.locator("text=★ Snow poem").count() === 1, "student stars a piece");
const imgSrc = await S.page.locator("article:has-text('Texture rubbings') img").getAttribute("src");
ok((await S.page.request.get(`${BASE}${imgSrc}`)).status() === 200, "the student can open their own file");
await shot(S.page, "25-studio");
await S.page.goto(`${BASE}/student`);
ok(await S.page.locator("text=Open the studio").count() === 1, "handing in work ticks off Arts on Today");
await C.page.goto(`${BASE}/coach`);
await C.page.locator("a.card").first().click();
await C.page.click("a:has-text('Class studio')");
await C.page.waitForURL(/\/studio/);
await C.page.locator("article:has-text('Snow poem') input[name=body]").fill("Lovely sound words. Try a third line with a colour.");
await C.page.locator("article:has-text('Snow poem') button:has-text('Save feedback')").click();
ok((await flashText(C.page, "Feedback saved")).includes("Feedback saved"), "coach gives feedback in the class studio");
await shot(C.page, "26-class-studio");
const otherCoach = await session("othercoach");
await adultLogin(otherCoach.page, demo["Coach"].split(" / ")[0], demo["Coach"].split(" / ")[1]);
ok((await otherCoach.page.request.get(`${BASE}${imgSrc}`)).status() === 404, "a coach at another school can't open the file");

/* 6. parent joins with the family code */
const F = await session("parent");
await F.page.goto(`${BASE}/join`);
await F.page.fill("#code", stu["Family code for parents"]);
await F.page.fill("#firstName", "Pat"); await F.page.fill("#lastName", "Lee");
await F.page.fill("#email", `pat.${Date.now()}@example.com`); await F.page.fill("#password", "parent-password-1");
await F.page.click("button:has-text('Create parent account')");
await F.page.waitForURL(/\/parent/);
ok((await F.page.locator("h2").first().innerText()).includes("Jordan"), "parent sees their child");
if (schoolDay) ok(await F.page.locator("text=Checked in feeling").count() === 1 && await F.page.locator("text=How to check my work").count() === 1, "parent sees today's check-in and reflection");
await shot(F.page, "22-parent-day");
ok(await F.page.locator("text=Great effort this week").count() === 1, "parent sees the coach's shared note");
await F.page.click("a:has-text('Portfolio (2)')");
await F.page.waitForURL(/\/portfolio/);
ok(await F.page.locator("text=★ Snow poem").count() === 1 && await F.page.locator("text=Lovely sound words").count() === 1, "parent sees the portfolio, starred work first, with coach feedback");
await shot(F.page, "27-parent-portfolio");
await F.page.goBack();
await shot(F.page, "12-parent");
await F.page.click("a:has-text('See plan')");
await F.page.waitForURL(/\/students\//);
await F.page.waitForSelector("h1:has-text('Jordan')", { timeout: 15000 }).catch(() => {});
ok((await F.page.locator("h1").innerText()).includes("Jordan"), "parent opens child's plan");

/* 7. permissions */
const demoStudentLink = await (async () => { await P.page.goto(`${BASE}/school/people`); return P.page.locator("table a").first().getAttribute("href"); })();
for (const [who, s] of [["parent", F], ["coach (other school)", C], ["student", S]]) {
  const r = await s.page.goto(`${BASE}${demoStudentLink}`);
  ok(r.status() === 404, `${who} cannot open another school's student (${r.status()})`);
}
for (const [who, s, path] of [["student", S, "/school"], ["parent", F, "/coach"], ["coach", C, "/admin"]]) {
  await s.page.goto(`${BASE}${path}`);
  ok(!s.page.url().endsWith(path), `${who} is redirected away from ${path}`);
}
const anon = await session("anon");
await anon.page.goto(`${BASE}/school`);
ok(anon.page.url().endsWith("/login"), "signed-out visitor is sent to sign in");
await anon.page.goto(`${BASE}/`);
await shot(anon.page, "00-home");
await anon.page.goto(`${BASE}/login`);
await anon.page.fill("#email", process.env.ADMIN_EMAIL); await anon.page.fill("#password", "wrong");
await anon.page.click("button:has-text('Sign in')");
await anon.page.waitForSelector("[role=alert]");
ok(true, "wrong password shows an error");

/* 8. demo coach & phone view */
const [cEmail, cPw] = demo["Coach"].split(" / ");
const DC = await session("democoach");
await adultLogin(DC.page, cEmail, cPw);
await shot(DC.page, "13-coach-home");
await DC.page.click(".card >> nth=0"); await DC.page.waitForLoadState("networkidle");
await shot(DC.page, "14-demo-class");
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, colorScheme: "dark" });
const pp = await phone.newPage();
await pp.context().addCookies(await S.ctx.cookies());
await pp.goto(`${BASE}/student`);
const overflow = await pp.evaluate(() => document.documentElement.scrollWidth);
ok(overflow <= 390, `phone layout has no sideways scroll (${overflow}px)`);
await shot(pp, "15-phone-dark-student");

await browser.close();
console.log(problems.length ? `\n${problems.length} problem(s):\n- ${problems.join("\n- ")}` : "\nAll checks passed.");
process.exitCode = problems.length ? 1 : 0;
