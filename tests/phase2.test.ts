import { test } from "node:test";
import assert from "node:assert/strict";
import { nextStagePool, workingLevel, scoreAssessment, builtinPool, toStoredQuestion, type StoredQuestion } from "../src/lib/assessment.ts";
import { GENERATORS, generatedItem, generateMath } from "../src/lib/generators.ts";

const all = () => true;
const stage = (p: number, correct: number) => Array.from({ length: 3 }, (_, i) => ({ p, ok: i < correct }));

test("adaptive: strong student climbs until a stage is failed, capped at +3", () => {
  assert.equal(nextStagePool(5, [], all), 5);
  assert.equal(nextStagePool(5, stage(5, 3), all), 6);
  assert.equal(nextStagePool(5, [...stage(5, 3), ...stage(6, 2)], all), 7);
  assert.equal(nextStagePool(5, [...stage(5, 3), ...stage(6, 2), ...stage(7, 1)], all), null);
  assert.equal(workingLevel(5, [...stage(5, 3), ...stage(6, 2), ...stage(7, 1)]), 6);
  assert.equal(nextStagePool(5, [...stage(5, 3), ...stage(6, 3), ...stage(7, 3), ...stage(8, 3)], all), null);
  assert.equal(workingLevel(5, [...stage(5, 3), ...stage(6, 3), ...stage(7, 3), ...stage(8, 3)]), 8);
});

test("adaptive: struggling student steps down until a stage is passed", () => {
  assert.equal(nextStagePool(5, stage(5, 1), all), 4);
  assert.equal(nextStagePool(5, [...stage(5, 1), ...stage(4, 1)], all), 3);
  assert.equal(nextStagePool(5, [...stage(5, 1), ...stage(4, 1), ...stage(3, 2)], all), null);
  assert.equal(workingLevel(5, [...stage(5, 1), ...stage(4, 1), ...stage(3, 2)]), 3);
  assert.equal(workingLevel(1, [...stage(1, 0), ...stage(0, 0)]), -1);
  assert.equal(nextStagePool(1, [...stage(1, 0), ...stage(0, 0)], all), null, "never below Kindergarten");
});

test("adaptive scoring maps working level to Ontario levels", () => {
  const items = [...builtinPool("math", 5), ...builtinPool("math", 6)];
  const qs: StoredQuestion[] = items.map(it => ({ ...toStoredQuestion(it), order: [0, 1, 2, 3] }));
  const [r] = scoreAssessment(5, ["math"], qs, qs.map((q, i) => (q.p === 5 ? 0 : i % 3 === 0 ? 0 : 1)), undefined, "adaptive");
  assert.equal(r.working, 5);
  assert.equal(r.level, 3);
  assert.equal(r.status, "at");
});

test("every math generator makes valid questions that regenerate identically", () => {
  for (const g of GENERATORS) {
    for (let seed = 1; seed < 200; seed++) {
      const id = `gen:math:${g.id}:${seed * 7919}`;
      const a = generatedItem(id)!;
      assert.ok(a, `${g.id} seed ${seed}`);
      assert.equal(new Set(a.choices).size, 4, `${g.id} seed ${seed}: ${a.prompt} → ${a.choices.join(" | ")}`);
      assert.deepEqual(generatedItem(id), a);
      assert.ok(a.explanation.length > 10);
    }
  }
  assert.ok(generateMath(4, "Area of rectangles"));
  assert.equal(generateMath(4, "No such skill"), undefined);
});
