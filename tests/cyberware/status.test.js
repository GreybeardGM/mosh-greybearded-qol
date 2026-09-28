import test from "node:test";
import assert from "node:assert/strict";
import { getAugmentationStatusRows, getOverclockingLevelStates, OVERCLOCKING_TRIGGER_CLASS } from "../../scripts/cyberware/status.js";

test("contractor rows include zero-slot items and share combined Overclocking", () => {
  const previousGame = globalThis.game;
  globalThis.game = {
    i18n: { format: (key, values) => `${key}: ${values.overclocking}`, localize: key => key },
    settings: { get: () => undefined }
  };
  try {
    const cyberware = { id: "cyber", name: "Implant", type: "item", getFlag: (_, id) =>
      id === "cyberware" ? { enabled: true, slots: 0 } : {} };
    const slickware = { id: "slick", name: "Interface", type: "skill", getFlag: (_, id) =>
      id === "slickware" ? { enabled: true, slots: 6 } : {} };
    const rows = getAugmentationStatusRows({
      type: "creature",
      system: { stats: { instinct: { value: 30 } } },
      items: [cyberware, slickware]
    });
    assert.equal(rows.length, 2);
    assert.deepEqual(rows.map(row => row.items.map(item => item.name)), [["Implant"], ["Interface"]]);
    assert.equal(rows[0].selected, false);
    assert.equal(rows[1].selected, true);
    assert.equal(rows[1].label, "MoshQoL.Slickware.Overclocking: 3");
    assert.equal(rows[1].actionClass, OVERCLOCKING_TRIGGER_CLASS);
    assert.equal(rows[0].actionClass, "");
  } finally {
    globalThis.game = previousGame;
  }
});

test("dialog lists the five book levels and only reached levels are active", () => {
  assert.deepEqual(getOverclockingLevelStates(2).map(entry => entry.active), [true, true, false, false, false]);
  assert.deepEqual(getOverclockingLevelStates(5).map(entry => entry.active), [true, true, true, true, true]);
  assert.deepEqual(getOverclockingLevelStates(8).map(entry => entry.active), [true, true, true, true, true]);
});
