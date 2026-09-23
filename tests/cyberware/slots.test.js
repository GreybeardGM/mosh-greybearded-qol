import test from "node:test";
import assert from "node:assert/strict";
import { AUGMENTATION_DEFINITIONS } from "../../scripts/cyberware/config.js";
import {
  calculateAugmentationSlots,
  calculateAugmentationState,
  getAugmentation,
  getAugmentationItems
} from "../../scripts/cyberware/slots.js";

const [cyberware, slickware] = AUGMENTATION_DEFINITIONS;
const item = (type, flags = {}, system = {}) => ({
  type,
  system,
  getFlag: (_module, flag) => flags[flag]
});
const augmentation = (definition, slots, enabled = true) => ({
  [definition.id]: { enabled, slots }
});
const actor = (strength, sanity, items = []) => ({
  system: { stats: { strength: { value: strength }, sanity: { value: sanity } } },
  items
});

test("Cyberware accepts equipment while Slickware accepts skills and ordinary items", () => {
  const shared = item("item", { ...augmentation(cyberware, 1), ...augmentation(slickware, 2) });
  const weapon = item("weapon", augmentation(cyberware, 1));
  const skill = item("skill", augmentation(slickware, 1));
  const armorSlickware = item("armor", augmentation(slickware, 9));
  const skillCyberware = item("skill", augmentation(cyberware, 9));
  const character = actor(40, 30, [shared, weapon, skill, armorSlickware, skillCyberware]);

  assert.deepEqual(getAugmentationItems(character, cyberware), [shared, weapon]);
  assert.deepEqual(getAugmentationItems(character, slickware), [shared, skill]);
});

test("slot totals use Strength for Cyberware and Sanity for Slickware", () => {
  const character = actor(43, 39, [
    item("weapon", augmentation(cyberware, 6), { equipped: false }),
    item("skill", augmentation(slickware, 2)),
    item("item", augmentation(slickware, 1), { quantity: 10 })
  ]);
  assert.deepEqual(calculateAugmentationSlots(character, cyberware), { used: 6, max: 4, overclocking: 2 });
  assert.deepEqual(calculateAugmentationSlots(character, slickware), { used: 3, max: 3, overclocking: 0 });
});

test("Overclocking combines the excess from both systems", () => {
  const character = actor(43, 39, [
    item("item", {
      ...augmentation(cyberware, 6),
      ...augmentation(slickware, 6)
    })
  ]);
  assert.deepEqual(calculateAugmentationState(character), {
    cyberware: { used: 6, max: 4, overclocking: 2 },
    slickware: { used: 6, max: 3, overclocking: 3 },
    overclocking: 5
  });
});

test("each embedded item counts once regardless of quantity, equipment, or duplicate names", () => {
  const first = { ...item("item", augmentation(cyberware, 0), { quantity: 0 }), id: "first", name: "Implant" };
  const second = { ...item("armor", augmentation(cyberware, 2), { equipped: false }), id: "second", name: "Implant" };
  const character = actor(43, 30, [first, second]);
  assert.deepEqual(getAugmentationItems(character, cyberware), [first, second]);
  assert.equal(calculateAugmentationSlots(character, cyberware).used, 2);
});

test("status data includes enabled zero-slot items alongside its slot totals", () => {
  const zero = item("item", augmentation(cyberware, 0));
  const paid = item("skill", augmentation(slickware, 2));
  const state = calculateAugmentationState(actor(40, 30, [zero, paid]), { includeItems: true });
  assert.deepEqual(state.cyberware, { used: 0, max: 4, overclocking: 0, items: [zero] });
  assert.deepEqual(state.slickware, { used: 2, max: 3, overclocking: 0, items: [paid] });
});

test("malformed flags and stats cannot poison totals", () => {
  assert.deepEqual(getAugmentation({ getFlag: () => undefined }, slickware), {
    enabled: false,
    slots: 0,
    notes: ""
  });
  const character = actor(undefined, undefined, [
    item("item", augmentation(cyberware, NaN)),
    item("armor", augmentation(cyberware, -2)),
    item("weapon", augmentation(cyberware, Infinity)),
    item("weapon", augmentation(cyberware, 10)),
    item("armor", augmentation(cyberware, 999)),
    item("item", augmentation(cyberware, "3")),
    item("skill", augmentation(slickware, 9, "false"))
  ]);
  assert.deepEqual(calculateAugmentationState(character), {
    cyberware: { used: 3, max: 0, overclocking: 3 },
    slickware: { used: 0, max: 0, overclocking: 0 },
    overclocking: 3
  });
});
