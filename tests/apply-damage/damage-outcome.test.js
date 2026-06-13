import test from "node:test";
import assert from "node:assert/strict";

import { calculateDamageOutcome } from "../../scripts/apply-damage/damage-outcome.js";

const cases = [
  {
    name: "damage below current HP only lowers HP",
    input: { hp: 4, hpMax: 4, hits: 0, hitsMax: 3, remaining: 3 },
    expected: { hp: 1, hits: 0, remaining: 0, woundsGained: 0 }
  },
  {
    name: "damage equal to current HP creates exactly one wound and resets HP",
    input: { hp: 4, hpMax: 4, hits: 0, hitsMax: 3, remaining: 4 },
    expected: { hp: 4, hits: 1, remaining: 0, woundsGained: 1 }
  },
  {
    name: "damage just over current HP carries remainder into reset HP",
    input: { hp: 4, hpMax: 4, hits: 0, hitsMax: 3, remaining: 5 },
    expected: { hp: 3, hits: 1, remaining: 0, woundsGained: 1 }
  },
  {
    name: "damage spanning exactly two HP bars creates two wounds",
    input: { hp: 4, hpMax: 4, hits: 0, hitsMax: 3, remaining: 8 },
    expected: { hp: 4, hits: 2, remaining: 0, woundsGained: 2 }
  },
  {
    name: "damage over two HP bars carries final remainder into HP",
    input: { hp: 4, hpMax: 4, hits: 0, hitsMax: 3, remaining: 9 },
    expected: { hp: 3, hits: 2, remaining: 0, woundsGained: 2 }
  },
  {
    name: "zero current HP records a wound before applying remainder to reset HP",
    input: { hp: 0, hpMax: 4, hits: 1, hitsMax: 3, remaining: 1 },
    expected: { hp: 3, hits: 2, remaining: 0, woundsGained: 1 }
  },
  {
    name: "wound capacity stops at hits max and preserves unprocessed damage",
    input: { hp: 4, hpMax: 4, hits: 2, hitsMax: 3, remaining: 9 },
    expected: { hp: 4, hits: 3, remaining: 5, woundsGained: 1 }
  },
  {
    name: "actors without positive max HP receive one wound and stop",
    input: { hp: 0, hpMax: 0, hits: 0, hitsMax: 3, remaining: 5 },
    expected: { hp: 0, hits: 1, remaining: 0, woundsGained: 1 }
  }
];

for (const { name, input, expected } of cases) {
  test(name, () => {
    assert.deepEqual(calculateDamageOutcome(input), expected);
  });
}
