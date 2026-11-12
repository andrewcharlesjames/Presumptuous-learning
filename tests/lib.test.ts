import { test } from "node:test";
import assert from "node:assert/strict";
import { BANK } from "../src/lib/bank.ts";
import { buildQuestions, scoreAssessment, focusFor, type Answer } from "../src/lib/assessment.ts";
import { buildPlan } from "../src/lib/plan.ts";
import { subjectsForGrade } from "../src/lib/subjects.ts";
import { ontarioYear, easter } from "../src/lib/templates.ts";
import { isoDate, utcDate, todayIn, parseIsoDate } from "../src/lib/dates.ts";

test("every bank item has 4 distinct options", () => {
  for (const [sid, pools] of Object.entries(BANK)) for (const [p, items] of Object.entries(pools)) for (const it of items) {
    assert.ok(it.length === 7 || it.length === 8, `${sid}/${p}`);
    assert.equal(new Set(it.slice(3, 7)).size, 4, `${sid}/${p}: ${it[2]}`);
    if (it.length === 8) assert.ok(it[7]!.length > 10, `${sid}/${p}: explanation`);
  }
});

test("Phase 2 additions: every Language, Science and Social Studies pool has at least 6 questions", () => {
  for (const sid of ["lang", "sci", "soc"] as const) for (let p = 0; p <= 13; p++) assert.ok((BANK[sid][p]?.length ?? 0) >= 6, `${sid}/${p}`);
});

test("every grade gets an assessment for every subject it offers", () => {
  for (let g = 0; g <= 12; g++) {
    const sids = subjectsForGrade(g).map(s => s.id);
    const qs = buildQuestions(g, sids);
    for (const sid of sids) assert.ok(qs.filter(q => q.sid === sid && q.tier === "at").length === 3, `g${g} ${sid}`);
  }
});

test("scoring: all correct is above, all wrong is below level 1", () => {
  const sids = subjectsForGrade(5).map(s => s.id);
  const qs = buildQuestions(5, sids);
  const right = scoreAssessment(5, sids, qs, qs.map(() => 0));
  assert.ok(right.every(r => r.status === "above" && r.level === 4));
  const wrong = scoreAssessment(5, sids, qs, qs.map((): Answer => -1));
  assert.ok(wrong.every(r => r.status === "below" && r.level === 1));
  assert.ok(focusFor(wrong[0], 5)[0].mode === "repair");
});

test("plan builds for every grade, weekday and weekend", () => {
  for (const g of [0, 3, 8, 12]) {
    const sids = subjectsForGrade(g).map(s => s.id);
    const qs = buildQuestions(g, sids);
    const rs = scoreAssessment(g, sids, qs, qs.map((_, i) => (i % 3 === 0 ? 0 : 1)));
    for (const day of [utcDate(2026, 10, 12), utcDate(2026, 10, 14)]) {
      const plan = buildPlan({ grade: g, results: rs, today: day, yearEnd: utcDate(2027, 5, 25) });
      assert.ok(plan.today.blocks.length >= 3);
      assert.equal(plan.weeks.length, 4);
      assert.ok(plan.yearMonths.length >= 8);
      assert.ok(plan.sched.days.flat().length > 0);
    }
  }
});

test("Ontario calendar template 2026–27", () => {
  const y = ontarioYear(2026);
  assert.equal(isoDate(y.yearStart), "2026-09-08");
  assert.equal(isoDate(y.yearEnd), "2027-06-25");
  const byTitle = Object.fromEntries(y.events.map(e => [e.title, e]));
  assert.equal(isoDate(byTitle["Thanksgiving"].startDate), "2026-10-12");
  assert.equal(isoDate(byTitle["Winter break"].startDate), "2026-12-21");
  assert.equal(isoDate(byTitle["Winter break"].endDate), "2027-01-01");
  assert.equal(isoDate(byTitle["Family Day"].startDate), "2027-02-15");
  assert.equal(isoDate(byTitle["March break"].startDate), "2027-03-15");
  assert.equal(isoDate(byTitle["Victoria Day"].startDate), "2027-05-24");
  assert.equal(isoDate(easter(2027)), "2027-03-28");
});

test("dates", () => {
  assert.equal(isoDate(todayIn("America/Toronto", new Date("2026-11-12T03:00:00Z"))), "2026-11-11");
  assert.equal(parseIsoDate("2026-02-30"), null);
});
