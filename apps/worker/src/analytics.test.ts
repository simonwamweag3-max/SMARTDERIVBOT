import test from "node:test";
import assert from "node:assert/strict";
import { calculateDigitFrequencies, extractLastDigit, sampleShare } from "./analytics";

test("extractLastDigit preserves trailing zeroes in quote precision", () => {
  assert.equal(extractLastDigit("123.450"), 0);
  assert.equal(extractLastDigit("123.456"), 6);
  assert.equal(extractLastDigit("98"), 8);
  assert.equal(extractLastDigit("not-a-quote"), null);
});

test("calculateDigitFrequencies returns ten normalized buckets", () => {
  const result = calculateDigitFrequencies([0, 1, 1, 9, -1, 10]);
  assert.equal(result.length, 10);
  assert.equal(result[0].count, 1);
  assert.equal(result[1].percentage, 50);
  assert.equal(result[9].percentage, 25);
  assert.equal(result.reduce((sum, item) => sum + item.percentage, 0), 100);
});

test("empty samples return zero frequencies and share", () => {
  const result = calculateDigitFrequencies([]);
  assert.equal(result.every(item => item.percentage === 0), true);
  assert.equal(sampleShare(result, 4, 9), 0);
});

test("sampleShare adds the selected inclusive digit range", () => {
  const result = calculateDigitFrequencies([0, 1, 4, 5, 6, 9]);
  assert.ok(Math.abs(sampleShare(result, 4, 9) - (100 / 6 * 4)) < 1e-9);
  assert.throws(() => sampleShare(result, 8, 2), RangeError);
});
