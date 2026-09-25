import test from "node:test";
import assert from "node:assert/strict";
import { getAugmentationStatusRows } from "../../scripts/cyberware/status.js";

test("contractor rows include zero-slot items and share combined Overclocking", () => {
  const previousGame = globalThis.game;
  globalThis.game = {
    i18n: { format: (key, values) => `${key}: ${values.overclocking}` },
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
  } finally {
    globalThis.game = previousGame;
  }
});
