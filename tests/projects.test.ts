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

import { invoiceTotals, licenceState } from "../src/lib/licence.ts";

test("invoice totals add 13% Ontario HST", () => {
  assert.deepEqual(invoiceTotals(120, 4500), { subtotalCents: 540000, taxCents: 70200, totalCents: 610200 });
  assert.deepEqual(invoiceTotals(1, 999), { subtotalCents: 999, taxCents: 130, totalCents: 1129 });
});

test("licence warnings for ending soon, ended, and too many students", () => {
  const today = utcDate(2026, 10, 12);
  assert.equal(licenceState({ plan: "ACTIVE", seats: 100, licenceEnd: utcDate(2027, 7, 31) }, today, 80).warn, null);
  assert.match(licenceState({ plan: "PILOT", seats: 100, licenceEnd: utcDate(2026, 10, 30) }, today, 80).warn!, /ends in 18 days/);
  assert.match(licenceState({ plan: "PILOT", seats: 100, licenceEnd: utcDate(2026, 10, 1) }, today, 80).warn!, /ended 11 days ago/);
  assert.match(licenceState({ plan: "ACTIVE", seats: 10, licenceEnd: null }, today, 12).warn!, /12 students but your licence covers 10/);
});

test("licence warning is worded for platform staff", () => {
  const w = licenceState({ plan: "ACTIVE", seats: 10, licenceEnd: utcDate(2026, 10, 20) }, utcDate(2026, 10, 12), 12, "admin").warn!;
  assert.match(w, /^The school's active licence ends in 8 days\. The school has 12 students but its licence covers 10\.$/);
});
