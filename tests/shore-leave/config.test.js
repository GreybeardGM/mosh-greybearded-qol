import test from "node:test";
import assert from "node:assert/strict";
import { getDefaultShoreLeaveConfig, getShoreLeaveConfigWithDefaults } from "../../scripts/shore-leave/config.js";
import { SHORE_LEAVE_TIERS } from "../../scripts/shore-leave/default-tiers.js";

globalThis.foundry = { utils: { deepClone: structuredClone } };

test("Shore Leave defaults remain independent across callers and from the tier registry", () => {
  const first = getDefaultShoreLeaveConfig(), second = getDefaultShoreLeaveConfig();
  first.convertStress.noSanitySave = true;
  first.simpleShoreLeave.randomFlavor = false;
  first.tiers[0].basePrice.dice = 999;
  assert.equal(second.convertStress.noSanitySave, false);
  assert.equal(second.simpleShoreLeave.randomFlavor, true);
  assert.deepEqual(second.tiers, SHORE_LEAVE_TIERS);
});

test("custom configuration is normalized without sharing mutable input or silently accepting invalid tiers", () => {
  const source = { convertStress: { noSanitySave: true, noStressRelieve: "true", formula: " 2d5 " },
    simpleShoreLeave: { randomFlavor: false }, tiers: [null, structuredClone(SHORE_LEAVE_TIERS[0])] };
  const normalized = getShoreLeaveConfigWithDefaults(source);
  assert.deepEqual(normalized.convertStress, { noSanitySave: true, noStressRelieve: false, minStressConversion: false, formula: "2d5" });
  assert.equal(normalized.simpleShoreLeave.randomFlavor, false);
  assert.equal(normalized.tiers.length, 1);
  normalized.tiers[0].basePrice.dice = 999;
  assert.notEqual(source.tiers[1].basePrice.dice, 999);
  const fallback = getShoreLeaveConfigWithDefaults({ tiers: [null, {}] });
  assert.deepEqual(fallback, getDefaultShoreLeaveConfig());
});
