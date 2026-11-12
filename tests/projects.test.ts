import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultLaunchDay, milestoneDates, MILESTONES } from "../src/lib/projects.ts";
import { isoDate, utcDate } from "../src/lib/dates.ts";

test("Launch Day defaults to the third Thursday of May", () => {
  assert.equal(isoDate(defaultLaunchDay(2026)), "2027-05-20");
});

test("milestones run September to June, Launch Day in May", () => {
  const ds = milestoneDates("LIFE_SKILLS", 2026, utcDate(2027, 4, 20), utcDate(2026, 8, 8));
  assert.equal(ds.length, MILESTONES.LIFE_SKILLS.length);
  assert.equal(isoDate(ds[7]), "2027-05-20");
  for (let i = 1; i < ds.length; i++) assert.ok(ds[i] > ds[i - 1], `milestone ${i} after ${i - 1}`);
  assert.equal(ds[0].getUTCMonth(), 8);
});

test("a late start compresses the schedule: nothing is already overdue", () => {
  const today = utcDate(2026, 10, 12);
  const ds = milestoneDates("PURPOSE", 2026, utcDate(2027, 4, 20), today);
  assert.ok(ds.every(d => d > today));
  for (let i = 1; i < ds.length; i++) assert.ok(ds[i] > ds[i - 1]);
});
