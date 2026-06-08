import test from "node:test";
import assert from "node:assert/strict";

import { toRollFormula, toRollString } from "../../scripts/utils/to-roll-formula.js";

const cases = [
  {
    name: "plain dice stay identical in formulas and labels",
    input: { dice: 2, faces: 10 },
    formula: "2d10",
    label: "2d10"
  },
  {
    name: "advantage uses Foundry keep-high syntax and readable marker",
    input: { dice: 1, faces: 20, keep: "+" },
    formula: "{1d20,1d20}kh",
    label: "1d20 [+]"
  },
  {
    name: "normalized keep tokens are appended directly",
    input: { dice: 3, faces: 6, keep: "low", bonus: -1 },
    formula: "3d6kl + -1",
    label: "3d6kl + -1"
  },
  {
    name: "multipliers keep Foundry and display formatting separate",
    input: { dice: 1, faces: 100, bonus: 5, multiplier: 1000 },
    formula: "(1d100 + 5) * 1000",
    label: "(1d100 + 5) x 1k"
  }
];

for (const { name, input, formula, label } of cases) {
  test(name, () => {
    assert.equal(toRollFormula(input), formula);
    assert.equal(toRollString(input), label);
  });
}
