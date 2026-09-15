import test from "node:test";
import assert from "node:assert/strict";
import { calculateCyberwareSlots, getCyberware, getCyberwareItems } from "../../scripts/cyberware/slots.js";

const item = (type, slots, enabled = true, system = {}) => ({
  type, system, getFlag: () => ({ enabled, slots })
});
const actor = (strength, items = []) => ({ system: { stats: { strength: { value: strength } } }, items });

test("shortcuts retain distinct embedded items including zero-slot cyberware", () => {
  const first = { ...item("item", 0, true, { quantity: 0 }), id: "first", name: "Implant" };
  const second = { ...item("armor", 2, true, { equipped: false }), id: "second", name: "Implant" };
  const character = actor(43, [first, item("weapon", 3, false), second, item("skill", 1)]);
  const selected = getCyberwareItems(character);
  assert.equal(selected.length, 2);
  assert.equal(selected[0], first);
  assert.equal(selected[1], second);
  assert.equal(calculateCyberwareSlots(character).used, 2);
});

test("Strength 43 and six slots produce Overclocking 2; quantity/equipped are ignored", () => {
  const character = actor(43, [
    item("weapon", 1, true, { equipped: false }),
    item("armor", 2, true, { equipped: false }),
    item("item", 3, true, { quantity: 10 })
  ]);
  assert.deepEqual(calculateCyberwareSlots(character), { used: 6, max: 4, overclocking: 2 });
});

test("the limit is rounded down and only excess slots overclock", () => {
  for (const [strength, max, overclocking] of [[39, 3, 1], [40, 4, 0], [49, 4, 0], [50, 5, 0]]) {
    assert.deepEqual(calculateCyberwareSlots(actor(strength, [item("item", 4)])),
      { used: 4, max, overclocking });
  }
});

test("unmarked equipment and other item types consume no slots", () => {
  const character = actor(43, [item("armor", 9, false), item("skill", 9),
    { type: "weapon", getFlag: () => undefined }]);
  assert.deepEqual(calculateCyberwareSlots(character), { used: 0, max: 4, overclocking: 0 });
});

test("fresh calculation reflects flag edits, removal and Strength changes", () => {
  const character = actor(43, [item("item", 6)]);
  character.items[0] = item("item", 2);
  assert.equal(calculateCyberwareSlots(character).used, 2);
  character.system.stats.strength.value = 10;
  assert.equal(calculateCyberwareSlots(character).overclocking, 1);
  character.items.pop();
  assert.deepEqual(calculateCyberwareSlots(character), { used: 0, max: 1, overclocking: 0 });
});

test("missing or malformed flags cannot poison the total", () => {
  assert.deepEqual(getCyberware({ getFlag: () => undefined }), { enabled: false, slots: 0, notes: "" });
  const character = actor(undefined, [item("item", NaN), item("armor", -2),
    item("weapon", Infinity), item("item", "3"), item("item", 9, "false")]);
  assert.deepEqual(calculateCyberwareSlots(character), { used: 3, max: 0, overclocking: 3 });
});
