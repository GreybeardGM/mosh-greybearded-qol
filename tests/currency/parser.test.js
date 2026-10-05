import test from "node:test";
import assert from "node:assert/strict";
import { classifyCurrency, formatCurrency } from "../../scripts/utils/currency-parser.js";
import { currencyTestCases } from "./fixtures.js";

for (const [index, fixture] of currencyTestCases.entries()) {
  test(`parser lab ${index + 1}: ${String(fixture.input)}`, () => {
    const result = classifyCurrency(fixture.input);
    assert.equal(result.status, fixture.expected);
    if (fixture.value !== undefined) assert.equal(result.value, fixture.value);
    if (fixture.code !== undefined) assert.equal(result.code, fixture.code);
  });
}

test("an explicit notation never substitutes the other interpretation to avoid fractional Credits", () => {
  assert.deepEqual(classifyCurrency("10,123").candidates, [
    { notation: "de", credits: "10.123" }, { notation: "en", credits: "10123" }
  ]);
  assert.equal(classifyCurrency("10,123", { notation: "de" }).code, "fractional_credits");
  assert.equal(classifyCurrency("10,123", { notation: "en" }).value, 10123);
  assert.equal(classifyCurrency("10,123 kcr", { notation: "de" }).value, 10123);
  assert.equal(classifyCurrency("10,123 kcr", { notation: "en" }).value, 10123000);
});

test("formatting preserves exact amounts in both supported display locales", () => {
  for (const locale of ["de", "en"]) {
    for (const value of [0, 99, 100, 1234, 1234567, 100000000, 1350000000, Number.MAX_SAFE_INTEGER]) {
      const display = formatCurrency(value, { locale });
      assert.equal(classifyCurrency(display, { notation: locale }).value, value, display);
    }
  }
  assert.throws(() => formatCurrency("1,234"), RangeError);
  assert.throws(() => formatCurrency("wrong"), RangeError);
});
