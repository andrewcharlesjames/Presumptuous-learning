import { test } from "node:test";
import assert from "node:assert/strict";
import { artsPromptFor, lifePromptFor, mindfulnessFor } from "../src/lib/prompts.ts";
import { utcDate } from "../src/lib/dates.ts";

test("daily prompts rotate and cover every weekday track", () => {
  const d = utcDate(2026, 10, 12);
  assert.ok(mindfulnessFor(d).length > 10);
  assert.notEqual(artsPromptFor(d, 3), artsPromptFor(utcDate(2026, 10, 13), 3));
  for (let w = 0; w < 5; w++) assert.ok(lifePromptFor(d, 8, w).prompt.length > 10);
  assert.equal(lifePromptFor(d, 8, 0).track, "Financial literacy");
});
