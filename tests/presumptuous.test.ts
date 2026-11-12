import { test } from "node:test";
import assert from "node:assert/strict";
import { UNITS, applyText, bandOf, findEntSkill, nextSkill, skillsBetween, skillsOf, skillsSoFar, unitFor } from "../src/lib/presumptuous.ts";
import { draftEntComment, entLevel } from "../src/lib/report-rules.ts";
import { DEFAULT_DAY } from "../src/lib/templates.ts";
import { minutes, utcDate } from "../src/lib/dates.ts";

test("ten units, September to June, each with two business skills and one life skill for every grade band", () => {
  assert.equal(UNITS.length, 10);
  assert.deepEqual(UNITS.map(u => u.month), [8, 9, 10, 11, 0, 1, 2, 3, 4, 5]);
  for (const u of UNITS) {
    assert.equal(u.business.length, 4, u.title);
    assert.equal(u.life.length, 4, u.title);
    for (const pair of u.business) assert.equal(pair.length, 2);
  }
});

test("grade bands, monthly units and skills to date", () => {
  assert.deepEqual([0, 2, 3, 5, 6, 8, 9, 12].map(bandOf), [0, 0, 1, 1, 2, 2, 3, 3]);
  assert.equal(unitFor(utcDate(2026, 11, 3)).title, "Money: costs, prices and profit");
  assert.equal(unitFor(utcDate(2027, 6, 15)).title, "Results and what's next"); // summer falls back to June
  assert.deepEqual(skillsOf(unitFor(utcDate(2026, 11, 3)), 1).map(s => s.skill), ["Coins and bills", "Price, cost and profit at a lemonade stand", "Saving for something"]);
  assert.equal(skillsSoFar(utcDate(2026, 10, 12), 4).length, 9); // Sept, Oct, Nov
  assert.equal(skillsBetween(utcDate(2026, 11, 1), utcDate(2027, 1, 28), 10).length, 9); // Dec, Jan, Feb
  const mastered = new Set(["ent|Coins and bills"]);
  assert.equal(nextSkill(utcDate(2026, 11, 3), 1, mastered)?.skill, "Price, cost and profit at a lemonade stand");
  assert.equal(findEntSkill("Break-even analysis")?.unit.title, "Money: costs, prices and profit");
  assert.equal(findEntSkill("Not a skill"), null);
  assert.equal(applyText(UNITS[3], "Paw Patrol Walks"), "List what Paw Patrol Walks costs to make, choose a price, and work out the profit on one sale.");
});

test("Presumptuous Project report mark and comment", () => {
  assert.deepEqual(entLevel(9, 9), { level: 4, status: "above" });
  assert.deepEqual(entLevel(6, 9), { level: 3, status: "at" });
  assert.deepEqual(entLevel(0, 9), { level: 1, status: "below" });
  const c = draftEntComment({ first: "Amira", project: "Paw Patrol Walks", mastered: ["Needs and wants", "Who is a customer?"], taught: 9, stepsApproved: 2, stepsDue: 3, next: ["Asking good questions"] });
  assert.equal(c, "Amira has mastered 2 of 9 business and life skills this term, including needs and wants and who is a customer? Amira's business, Paw Patrol Walks, has 2 of 3 project steps approved so far. Next steps: Amira will work on asking good questions and apply them to their business.");
});

test("default week: 10 h academics, 8 h Presumptuous Project, 7 h arts, no overlaps on any day", () => {
  const hours = (kind: string) => DEFAULT_DAY.filter(b => b.kind === kind).reduce((a, b) => a + (minutes(b.end) - minutes(b.start)) * b.days.length, 0) / 60;
  assert.equal(hours("ACADEMICS"), 10);
  assert.equal(hours("LIFE_SKILLS"), 8);
  assert.equal(hours("ARTS"), 7);
  for (let d = 0; d < 5; d++) {
    const day = DEFAULT_DAY.filter(b => b.days.includes(d)).sort((a, b) => a.start.localeCompare(b.start));
    for (let i = 1; i < day.length; i++) assert.ok(day[i].start >= day[i - 1].end, `day ${d}: ${day[i].title}`);
    assert.equal(day[0].start, "09:00"); assert.equal(day.at(-1)!.end, "16:00");
  }
});
