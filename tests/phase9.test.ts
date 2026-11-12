import { test } from "node:test";
import assert from "node:assert/strict";
import { checkClaims, parseIdToken } from "../src/lib/sso-claims.ts";
import { currentTerm, draftComment, markFor, suggestSkills } from "../src/lib/report-rules.ts";
import { utcDate } from "../src/lib/dates.ts";

const now = Date.UTC(2026, 10, 12, 15);
const good = { iss: "https://accounts.google.com", aud: "client-1", exp: now / 1000 + 600, nonce: "n1", sub: "g-123", email: "Coach@School.ca", email_verified: true, name: "Casey Coach" };

test("Google ID token: accepted only with the right issuer, audience, nonce and expiry", () => {
  const id = checkClaims("google", good, "client-1", "n1", now);
  assert.deepEqual(id, { sub: "g-123", email: "coach@school.ca", emailVerified: true, name: "Casey Coach" });
  for (const bad of [{ iss: "https://evil.example" }, { aud: "someone-else" }, { nonce: "other" }, { exp: now / 1000 - 3600 }, { sub: 42 }])
    assert.deepEqual(checkClaims("google", { ...good, ...bad }, "client-1", "n1", now), { error: "token" }, JSON.stringify(bad));
  assert.equal((checkClaims("google", { ...good, email_verified: false }, "client-1", "n1", now) as { emailVerified: boolean }).emailVerified, false);
});

test("Microsoft ID token: tenant issuer required and email never treated as verified", () => {
  const ms = { ...good, iss: "https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0", email: undefined, preferred_username: "coach@board.ca" };
  const id = checkClaims("microsoft", ms, "client-1", "n1", now) as { email: string; emailVerified: boolean };
  assert.equal(id.email, "coach@board.ca");
  assert.equal(id.emailVerified, false);
  assert.deepEqual(checkClaims("microsoft", { ...ms, iss: "https://login.microsoftonline.com/common/v2.0" }, "client-1", "n1", now), { error: "token" });
});

test("parseIdToken reads the payload and rejects junk", () => {
  const t = `x.${Buffer.from(JSON.stringify({ sub: "a" })).toString("base64url")}.y`;
  assert.deepEqual(parseIdToken(t), { sub: "a" });
  assert.equal(parseIdToken("nonsense"), null);
  assert.equal(parseIdToken("a.%%%.b"), null);
});

test("report terms follow the Ontario calendar", () => {
  assert.equal(currentTerm(utcDate(2026, 10, 12)), 0); // November: fall progress report
  assert.equal(currentTerm(utcDate(2027, 1, 10)), 1); // February: term 1
  assert.equal(currentTerm(utcDate(2027, 5, 20)), 2); // June: term 2
});

test("marks: progress words in the fall, letters for grades 1-6, percentages for 7-12, none for Kindergarten", () => {
  assert.equal(markFor(0, 4, 3, "at"), "Progressing well");
  assert.equal(markFor(0, 4, 4, "above"), "Progressing very well");
  assert.equal(markFor(0, 4, 2, "below"), "Progressing with difficulty");
  assert.equal(markFor(1, 4, 4, "above"), "A");
  assert.equal(markFor(2, 6, 1, "below"), "D");
  assert.equal(markFor(1, 8, 3, "at"), "70–79%");
  assert.equal(markFor(1, 0, 3, "at"), "");
});

test("learning skills are suggested from the term's evidence, and not before there's enough", () => {
  const strong = { schoolDays: 40, present: 39, late: 1, completeDays: 36, reflections: 38, practiceSets: 45, assignmentsDue: 4, assignmentsDone: 4, projectStepsApproved: 2, projectStepsDue: 2, masteredSkills: 10 };
  assert.deepEqual(suggestSkills(strong), { responsibility: "E", organization: "E", independent: "E", initiative: "E", selfRegulation: "E" });
  const weak = { ...strong, completeDays: 10, reflections: 12, practiceSets: 5, assignmentsDone: 1, projectStepsApproved: 0, masteredSkills: 1 };
  const w = suggestSkills(weak);
  assert.equal(w.organization, "N");
  assert.equal(w.collaboration, undefined); // always the coach's call
  assert.deepEqual(suggestSkills({ ...strong, schoolDays: 3 }), {});
});

test("comment drafts name a strength and a next step", () => {
  const c = draftComment({ first: "Amira", subject: "Mathematics", status: "above", workingGrade: "Grade 4", mastered: ["Fractions of a set", "Skip counting"], next: ["Decimal tenths"] });
  assert.equal(c, "Amira is working above grade level in Mathematics, at a Grade 4 level. Amira has shown mastery of fractions of a set and skip counting. Next steps: Amira will work on decimal tenths.");
});
