import { METHODS, type Mode, type SubjectId } from "./bank.ts";
import { builtinPool, focusFor, type Focus, type Status, type SubjectResult } from "./assessment.ts";
import { addDays, MONTHS, mondayOf, weekdayIndex } from "./dates.ts";
import { gradeName } from "./subjects.ts";

export type BlockMode = Mode | "habit";
export const MODE_LABEL: Record<BlockMode, string> = { repair: "Repair", practice: "Secure", stretch: "Stretch", habit: "Habit" };

/** Activity text split around the skill so the UI can emphasise it. */
export type HowTo = { before: string; skill: string; after: string };
export type PlanBlock = { min: number; title: string; mode: BlockMode; sid?: SubjectId; skill?: string; grade?: number; how: HowTo };

const PROPER = /^(Canada|Canadian|Canada's|Ontario|French|First|Indigenous|Shakespearean|Pythagorean|Ohm's|MLA|SMART|EQAO|OSSLT|Big-O|Renaissance|Impressionism|Maslow's|Le|Gibbs)\b/;
/** "Physical regions of Canada" → "physical regions of Canada"; leaves proper nouns and acronyms alone. */
export function inSentence(skill: string): string {
  if (PROPER.test(skill) || /^[A-Z0-9]{2,}/.test(skill)) return skill;
  return skill.charAt(0).toLowerCase() + skill.slice(1);
}

export function howTo(sid: SubjectId, f: Focus, grade: number): HowTo {
  let t = METHODS[sid][f.mode];
  if (grade <= 2) t = "With a grown-up: " + t.charAt(0).toLowerCase() + t.slice(1);
  const [before, after = ""] = t.split("{s}");
  return { before, skill: inSentence(f.skill), after };
}
const plain = (text: string): HowTo => ({ before: text, skill: "", after: "" });
export const howToText = (h: HowTo) => h.before + h.skill + h.after;

export function band(g: number) {
  if (g === 0) return { total: 30, read: 10, slots: 2 };
  if (g <= 3) return { total: 45, read: 15, slots: 2 };
  if (g <= 6) return { total: 75, read: 20, slots: 3 };
  if (g <= 8) return { total: 90, read: 20, slots: 3 };
  return { total: 120, read: 25, slots: 3 };
}

/** Spread subject sessions across Mon–Fri: below = 4/week, at = 3, above = 2, trimmed to fit. */
export function weekSchedule(rs: SubjectResult[], grade: number) {
  const b = band(grade);
  const want: Record<Status, number> = { below: 4, at: 3, above: 2 };
  const floor: Record<Status, number> = { below: 2, at: 1, above: 1 };
  const w: Record<string, number> = {};
  rs.forEach(r => (w[r.sid] = want[r.status]));
  let total = 5 * b.slots;
  const minSum = rs.reduce((a, r) => a + floor[r.status], 0);
  if (minSum > total) total = Math.ceil(minSum / 5) * 5;
  const sum = () => Object.values(w).reduce((a, x) => a + x, 0);
  const order: Status[] = ["above", "at", "below"];
  for (let guard = 0; sum() > total && guard < 200; guard++) {
    let done = false;
    for (const st of order) {
      const c = rs.filter(r => r.status === st && w[r.sid] > floor[st])
        .sort((a, z) => w[z.sid] - w[a.sid] || (["lang", "math"].includes(a.sid) ? 1 : -1));
      if (c.length) { w[c[0].sid]--; done = true; break; }
    }
    if (!done) break;
  }
  for (let guard = 0; sum() < total && guard < 200; guard++) {
    const c = rs.filter(r => w[r.sid] < 5)
      .sort((a, z) => (order.indexOf(z.status) - order.indexOf(a.status)) || (w[a.sid] - w[z.sid]));
    if (!c.length) break;
    w[c[0].sid]++;
  }
  const days: SubjectId[][] = [[], [], [], [], []];
  let rot = 0;
  rs.slice().sort((a, z) => w[z.sid] - w[a.sid]).forEach(r => {
    for (let k = 0; k < w[r.sid]; k++) {
      let best = -1;
      for (let j = 0; j < 5; j++) {
        const d = (rot + j) % 5;
        if (days[d].includes(r.sid)) continue;
        if (best < 0 || days[d].length < days[best].length) best = d;
      }
      if (best >= 0) { days[best].push(r.sid); rot = (best + 2) % 5; }
    }
  });
  return { days, w, perDay: Math.max(0, ...days.map(d => d.length)) };
}

const round5 = (n: number) => Math.max(10, Math.round(n / 5) * 5);

export type YearMonth = { y: number; m: number; ph: 1 | 2 | 3 | 4 | 5; phaseName: string; goal: string; items: string[]; milestones: string[] };

export type PlanInput = {
  grade: number;
  results: SubjectResult[];
  today: Date; // UTC-midnight calendar date
  yearEnd: Date; // last day of the school year
  extraMilestones?: { date: Date; title: string }[];
  /** Skills in the bank per subject and grade pool. Defaults to the built-in bank. */
  skillsAt?: SkillsAt;
  /** Skills the student has already mastered, as "subject|skill". They are left out of the plan. */
  mastered?: Set<string>;
};
export type SkillsAt = (sid: SubjectId) => (p: number) => string[];
export const builtinSkills: SkillsAt = sid => p => builtinPool(sid, p).map(x => x.skill);

export function buildPlan({ grade: g, results: rs, today, yearEnd, extraMilestones = [], skillsAt = builtinSkills, mastered = new Set() }: PlanInput) {
  const b = band(g);
  const focus = Object.fromEntries(rs.map(r => {
    const all = focusFor(r, g, skillsAt(r.sid));
    const open = all.filter(f => !mastered.has(`${r.sid}|${f.skill}`));
    return [r.sid, open.length ? open : [{ skill: "an independent inquiry project", mode: "stretch", grade: Math.min(13, r.working + 2) }]];
  })) as Record<SubjectId, Focus[]>;
  const sched = weekSchedule(rs, g);
  const byId = Object.fromEntries(rs.map(r => [r.sid, r])) as Record<SubjectId, SubjectResult>;
  const next = gradeName(Math.min(g + 1, 13));

  /* ---- Today ---- */
  const wd = weekdayIndex(today);
  const weekend = wd > 4;
  const blocks: PlanBlock[] = [];
  if (!weekend) {
    const list = sched.days[wd];
    const mins = round5((b.total - 10 - b.read) / Math.max(1, list.length));
    blocks.push({ min: 5, title: "Warm-up: quick recall", mode: "habit", how: plain("Answer 3 questions from yesterday's work without looking. Check them, and note anything you forgot.") });
    list.forEach(sid => {
      const occ = sched.days.slice(0, wd).filter(d => d.includes(sid)).length;
      const f = focus[sid][occ % focus[sid].length];
      blocks.push({ min: mins, title: `${byId[sid].name} · ${f.skill}`, mode: f.mode, sid, skill: f.skill, grade: f.grade, how: howTo(sid, f, g) });
    });
    blocks.push({ min: b.read, title: "Independent reading", mode: "habit", how: plain(g <= 2 ? "Read together with a grown-up. Take turns reading pages, then retell the story in order." : "Read a book you chose. Write down one new word and what it means.") });
    blocks.push({ min: 5, title: "Reflect", mode: "habit", how: plain("Write one thing you learned today and one question you still have.") });
  } else {
    const weak = rs.find(r => r.status === "below") ?? rs.find(r => r.status === "at");
    const strong = rs.find(r => r.status === "above") ?? rs[0];
    blocks.push({ min: b.read + 5, title: "Weekend reading", mode: "habit", how: plain("Read for fun: a library book, a graphic novel or a magazine. Tell someone about it.") });
    if (weak) { const f = focus[weak.sid][0]; blocks.push({ min: 15, title: `${weak.name} · ${f.skill}`, mode: f.mode, sid: weak.sid, skill: f.skill, grade: f.grade, how: howTo(weak.sid, f, g) }); }
    if (strong) {
      const f = focus[strong.sid].find(x => x.mode === "stretch") ?? focus[strong.sid][0];
      blocks.push({ min: 20, title: `${strong.name} · ${f.skill}`, mode: "stretch", sid: strong.sid, skill: f.skill, grade: f.grade, how: howTo(strong.sid, { ...f, mode: "stretch" }, g) });
    }
    blocks.push({ min: 30, title: "Hands-on learning", mode: "habit", how: plain("Cook with a recipe (fractions and measuring), take a nature walk and record 5 observations, or visit a museum or library.") });
  }

  /* ---- Month: 4 weeks ---- */
  const mon = mondayOf(today);
  const themes = [
    { title: "Close the gaps", detail: "Repair the skills missed on the assessment. Keep every session short and specific." },
    { title: "Secure grade level", detail: `Practise every ${gradeName(g)} expectation until it's easy. Mix in review from week 1.` },
    { title: "Reach ahead", detail: `Start ${next} skills in every subject. Treat mistakes as part of the work.` },
    { title: "Check and raise the bar", detail: "Review weeks 1–3 early in the week, then retake the assessment on Friday and compare." },
  ];
  const weeks = themes.map((th, k) => {
    const start = addDays(mon, 7 * k);
    const lines = rs.map(r => {
      const f = focus[r.sid];
      let picks: Focus[] = [];
      if (k === 0) picks = f.slice(0, 2);
      else if (k === 1) picks = f.filter(x => x.mode !== "stretch").slice(2, 4).concat(f.filter(x => x.mode === "practice").slice(0, 1));
      else if (k === 2) picks = f.filter(x => x.mode === "stretch").slice(0, 2);
      if (k < 3 && !picks.length) { const s = (k * 2) % f.length; picks = f.slice(s, s + 2); }
      const uniq = [...new Map(picks.map(p => [p.skill, p])).values()].slice(0, 2);
      return { sid: r.sid, name: r.name, status: r.status, picks: uniq, sessions: sched.w[r.sid] };
    });
    return { start, ...th, lines };
  });

  /* ---- Year ---- */
  let cy = today.getUTCFullYear(), cm = today.getUTCMonth();
  if (cm === 6 || cm === 7) cm = 8; // summer → plan from September
  const endY = yearEnd.getUTCFullYear();
  const months: { y: number; m: number }[] = [];
  while (cy < endY || (cy === endY && cm <= 7)) {
    months.push({ y: cy, m: cm });
    cm++; if (cm > 11) { cm = 0; cy++; }
    if (months.length > 14) break;
  }
  const school = months.filter(x => x.m !== 6 && x.m !== 7);
  const N = school.length;
  const cut = [Math.max(1, Math.round(N * 0.2)), Math.max(1, Math.round(N * 0.3)), Math.max(1, Math.round(N * 0.3))];
  const phaseOf = (i: number): 1 | 2 | 3 | 4 => i < cut[0] ? 1 : i < cut[0] + cut[1] ? 2 : i < cut[0] + cut[1] + cut[2] ? 3 : 4;
  const PH = {
    1: { name: "Close the gaps", goal: "Every subject reaches grade level." },
    2: { name: "Secure grade level", goal: "Grade-level skills become automatic." },
    3: { name: "Move ahead", goal: `Begin ${next} content in every subject.` },
    4: { name: "Lead", goal: "Above grade level in every subject." },
    5: { name: "Summer bridge", goal: `Keep skills sharp and preview ${next}.` },
  } as const;
  const names = (s: Status) => rs.filter(r => r.status === s).map(r => r.name).join(", ");
  const below = names("below"), at = names("at"), above = names("above");
  let si = 0;
  const yearMonths: YearMonth[] = months.map(x => {
    const summer = x.m === 6 || x.m === 7;
    const ph = summer ? 5 : phaseOf(si);
    const idx = summer ? -1 : si++;
    const lastOfPhase = !summer && (idx === N - 1 || phaseOf(idx + 1) !== ph);
    const items: string[] = [];
    if (ph === 1) {
      if (below) items.push(`Daily repair work in ${below}.`);
      if (at) items.push(`Three sessions a week to secure ${at}.`);
      if (above) items.push(`Launch stretch projects in ${above}.`);
    } else if (ph === 2) {
      items.push(`Work through every ${gradeName(g)} strand, with mixed review each week.`);
      if (below) items.push(`Keep extra time for ${below} until it tests at grade level.`);
      if (above) items.push(`Keep ${above} one grade ahead with independent work.`);
    } else if (ph === 3) {
      items.push(`Introduce ${next} skills in all subjects.`);
      items.push("Use weekly stretch tasks; send any slipping subject back to repair mode for a week.");
    } else if (ph === 4) {
      items.push(`Work on ${next} material independently and teach a concept to someone else.`);
      items.push("Final reassessment: target Level 4 in every subject.");
    } else {
      items.push("Read 20–30 minutes a day; join the public library's summer reading club.");
      items.push("Two math sessions a week and one project in the subject you enjoy most.");
    }
    const ms: string[] = [];
    if (lastOfPhase && ph < 4) ms.push("Retake the assessment at month end");
    if (x.m === 4 && [3, 6].includes(g)) ms.push("EQAO reading, writing and math window (check your school's dates)");
    if (x.m === 4 && g === 10) ms.push("OSSLT literacy test window (check your school's dates)");
    if (x.m === 5 && g === 9) ms.push("EQAO Grade 9 math assessment (during the math course)");
    extraMilestones.filter(e => e.date.getUTCFullYear() === x.y && e.date.getUTCMonth() === x.m).forEach(e => ms.push(e.title));
    return { y: x.y, m: x.m, ph, phaseName: PH[ph].name, goal: PH[ph].goal, items, milestones: ms };
  });
  const endOfPhase = (p: number) => { const a = yearMonths.filter(x => x.ph === p); return a[a.length - 1]; };
  const mName = (x?: YearMonth) => x ? `${MONTHS[x.m].slice(0, 3)} ${x.y}` : "";
  const traj = rs.map(r => {
    const steps: { when: string; st: Status; note?: string }[] = [{ when: "Now", st: r.status }];
    if (r.status === "below") { steps.push({ when: mName(endOfPhase(1) ?? endOfPhase(2)), st: "at" }); steps.push({ when: mName(endOfPhase(4) ?? endOfPhase(3)), st: "above" }); }
    else if (r.status === "at") { steps.push({ when: mName(endOfPhase(2)), st: "at" }); steps.push({ when: mName(endOfPhase(3) ?? endOfPhase(4)), st: "above" }); }
    else steps.push({ when: mName(endOfPhase(4) ?? endOfPhase(3)), st: "above", note: "working a grade ahead" });
    return { sid: r.sid, name: r.name, steps };
  });
  const fm = endOfPhase(4) ?? endOfPhase(3);
  return {
    today: { date: today, weekend, blocks },
    sched, weeks, yearMonths, traj,
    finalMonth: fm ? `${MONTHS[fm.m]} ${fm.y}` : "June",
    focus,
  };
}
export type Plan = ReturnType<typeof buildPlan>;

/** Next-grade skills not yet shown on the assessment: used for "requirements to reach the next level". */
export function nextLevelSkills(r: SubjectResult, grade: number, skillsAt: SkillsAt = builtinSkills): { skill: string; grade: number }[] {
  const at = skillsAt(r.sid);
  const target = r.status === "below" ? Math.max(r.working + 1, 0) : r.working + 1;
  const out: { skill: string; grade: number }[] = [];
  const add = (skill: string, g: number) => { if (!out.some(o => o.skill === skill)) out.push({ skill, grade: g }); };
  r.items.filter(x => !x.ok && x.p === target).forEach(x => add(x.d.skill, x.p));
  if (r.status === "below") r.items.filter(x => !x.ok && x.p <= grade).forEach(x => add(x.d.skill, x.p));
  if (target <= 13) at(target).forEach(s => add(s, target));
  return out.slice(0, 4);
}

/** The grade level a subject needs to show next. */
export const nextTarget = (r: SubjectResult) => Math.min(13, Math.max(0, r.working + 1));
