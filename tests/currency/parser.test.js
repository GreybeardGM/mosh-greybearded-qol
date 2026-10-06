import test from "node:test";
import assert from "node:assert/strict";
import { classifyCurrency, formatCurrency } from "../../scripts/utils/currency-parser.js";
import { currencyTestCases } from "./fixtures.js";

for (const [index, fixture] of currencyTestCases.entries()) {
  test(`parser lab ${index + 1}: ${String(fixture.input)}`, () => {
    const result = classifyCurrency(fixture.input, { notation: fixture.notation ?? "en" });
    assert.equal(result.status, fixture.expected);
    if (fixture.value !== undefined) assert.equal(result.value, fixture.value);
    if (fixture.code !== undefined) assert.equal(result.code, fixture.code);
  });
}

test("notation is explicit: decimal fractions never fall back to thousands", () => {
  assert.equal(classifyCurrency("10,123", { notation: "de" }).code, "fractional_credits");
  assert.equal(classifyCurrency("10,123", { notation: "en" }).value, 10123);
  assert.equal(classifyCurrency("10,123 kcr", { notation: "de" }).value, 10123);
  assert.equal(classifyCurrency("10,123 kcr", { notation: "en" }).value, 10123000);
  assert.equal(classifyCurrency("1.234.567", { notation: "en" }).status, "invalid");
  assert.equal(classifyCurrency("1,234,567", { notation: "de" }).status, "invalid");
  assert.equal(classifyCurrency("123", { notation: "unknown" }).status, "invalid");
  assert.equal(classifyCurrency("123", { notation: "toString" }).status, "invalid");
});

test("French spacing and Swiss apostrophes are supported only in their configured notation", () => {
  for (const group of [" ", "\u00a0", "\u202f"]) {
    const input = `1${group}234${group}567,89 kCr`;
    assert.equal(classifyCurrency(input, { notation: "fr" }).value, 1234567890);
    for (const notation of ["en", "de", "ch"]) assert.equal(classifyCurrency(input, { notation }).status, "invalid");
    assert.equal(classifyCurrency(`12${group}34 CR`, { notation: "fr" }).status, "invalid");
  }
  for (const group of ["'", "’"]) {
    const input = `1${group}234${group}567.89 kcr`;
    assert.equal(classifyCurrency(input, { notation: "ch" }).value, 1234567890);
    for (const notation of ["en", "de", "fr"]) assert.equal(classifyCurrency(input, { notation }).status, "invalid");
    assert.equal(classifyCurrency(`1${group}23 CR`, { notation: "ch" }).status, "invalid");
  }
  assert.equal(classifyCurrency("1  234 CR", { notation: "fr" }).status, "invalid");
  assert.equal(classifyCurrency("1 234,56 CR", { notation: "fr" }).code, "fractional_credits");
  assert.equal(classifyCurrency("1’234.56 CR", { notation: "ch" }).code, "fractional_credits");
});

test("canonical formatting is deterministic and exact in all four conventions", () => {
  const samples = { en: "1,234,567 cr", de: "1.234.567 cr", fr: "1\u202f234\u202f567 cr", ch: "1’234’567 cr" };
  for (const notation of Object.keys(samples)) {
    assert.equal(formatCurrency(1234567, { notation }), samples[notation]);
    for (const value of [0, 99, 100, 1234, 1234567, 100000000, 1350000000, Number.MAX_SAFE_INTEGER]) {
      const display = formatCurrency(value, { notation });
      assert.equal(classifyCurrency(display, { notation }).value, value, display);
    }
    // Exercise compact prefixes and all boundary sizes without floating-point arithmetic.
    for (let value = 0; value < 1000; value++) {
      for (const scale of [1, 1000, 1000000, 1000000000]) {
        const amount = value * scale + value;
        assert.equal(classifyCurrency(formatCurrency(amount, { notation }), { notation }).value, amount);
        assert.equal(classifyCurrency(formatCurrency(value * scale, { notation }), { notation }).value, value * scale);
      }
    }
  }
  assert.throws(() => formatCurrency("wrong"), RangeError);
  assert.throws(() => formatCurrency(123, { notation: "unknown" }), RangeError);
});
