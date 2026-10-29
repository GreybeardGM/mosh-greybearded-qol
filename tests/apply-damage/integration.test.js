import test from "node:test";
import assert from "node:assert/strict";
import { resetFoundryEnvironment, warnings, state } from "../helpers/foundry-environment.js";


test.beforeEach(resetFoundryEnvironment);

function damageActor(id = "target") {
  return Object.assign(new Actor(), {
    id, uuid: `Actor.${id}`, type: "character", name: id, statuses: new Set(), writes: [],
    system: { health: { value: 10, max: 10 }, hits: { value: 0, max: 3 }, stats: { armor: { mod: 3 } } },
    async update(data) { this.writes.push(data); }, sheet: {}, getFlag: () => null
  });
}

test("damage public entry points normalize raw values once and preserve anti-armor behavior", async t => {
  const previousActor = Actor;
  globalThis.Actor = class {};
  t.after(() => { globalThis.Actor = previousActor; });
  const { applyDamage, applyDamageToActors } = await import("../../scripts/apply-damage/apply-damage.js");
  for (const single of [true, false]) {
    for (const [antiArmor, expectedHp] of [["false", 8], ["true", 5]]) {
      const target = damageActor();
      let parses = 0;
      const input = { valueOf: () => { parses += 1; return 5.9; } };
      const result = single
        ? await applyDamage(target, input, antiArmor)
        : await applyDamageToActors([target, { actor: target }], { damage: input, antiArmorHit: antiArmor });
      assert.equal(result, single ? true : 1);
      assert.equal(parses, 1);
      assert.deepEqual(target.writes, [{ "system.health.value": expectedHp, "system.hits.value": 0 }]);
    }
  }
});

test("damage cancellation and invalid values never update an Actor; selected dialog targets remain authoritative", async t => {
  const previousActor = Actor, previousCanvas = globalThis.canvas;
  globalThis.Actor = class {};
  const { applyDamage, applyDamageToActors } = await import("../../scripts/apply-damage/apply-damage.js");
  const { ApplyDamageInputApp } = await import("../../scripts/apply-damage/damage-input-app.js");
  const previousWait = ApplyDamageInputApp.waitForInput;
  t.after(() => { globalThis.Actor = previousActor; globalThis.canvas = previousCanvas; ApplyDamageInputApp.waitForInput = previousWait; });
  const first = damageActor("first"), second = damageActor("second");
  ApplyDamageInputApp.waitForInput = async () => null;
  assert.equal(await applyDamage(first), false);
  for (const input of [0, -2, "bad", Infinity]) {
    assert.equal(await applyDamage(first, input), false);
    assert.equal(await applyDamageToActors([first], { damage: input }), false);
  }
  assert.deepEqual(first.writes, []);
  state.settings.applyDamageTargetLogic = "alwaysToken";
  globalThis.canvas = { tokens: { controlled: [{ actor: first }, { actor: second }] } };
  ApplyDamageInputApp.waitForInput = async () => ({ damage: "5", antiArmor: false, selectedTargetIndexes: [1, 1, 99] });
  assert.equal(await applyDamage(null), true);
  assert.deepEqual(first.writes, []);
  assert.deepEqual(second.writes, [{ "system.health.value": 8, "system.hits.value": 0 }]);
});

test("scene controls forward raw damage through the shared validator for the selected targets only", async t => {
  const previousActor = Actor, previousCanvas = globalThis.canvas, previousHooks = globalThis.Hooks;
  globalThis.Actor = class {};
  const hooks = new Map();
  globalThis.Hooks = { on: (name, callback) => hooks.set(name, callback) };
  const { registerApplyDamageSceneControl } = await import("../../scripts/apply-damage/scene-control.js");
  const { ApplyDamageInputApp } = await import("../../scripts/apply-damage/damage-input-app.js");
  const previousWait = ApplyDamageInputApp.waitForInput;
  t.after(() => {
    globalThis.Actor = previousActor; globalThis.canvas = previousCanvas; globalThis.Hooks = previousHooks;
    ApplyDamageInputApp.waitForInput = previousWait;
  });
  const first = damageActor("first"), second = damageActor("second");
  globalThis.canvas = { tokens: { controlled: [{ actor: first }, { actor: first }, { actor: second }] } };
  state.settings.applyDamageConfig = { visibility: "everyone" };
  registerApplyDamageSceneControl();
  const controls = { tokens: { tools: {} } };
  hooks.get("getSceneControlButtons")(controls);
  const click = controls.tokens.tools.applyDamage.onClick;
  ApplyDamageInputApp.waitForInput = async ({ targets }) => {
    assert.deepEqual(targets, [first, second]);
    return { damage: "5.9", antiArmor: "false", selectedTargetIndexes: [1] };
  };
  await click();
  assert.deepEqual(first.writes, []);
  assert.deepEqual(second.writes, [{ "system.health.value": 8, "system.hits.value": 0 }]);
  ApplyDamageInputApp.waitForInput = async () => ({ damage: "bad", selectedTargetIndexes: [0] });
  await click();
  assert.deepEqual(first.writes, []);
  assert.ok(warnings.includes("MoshQoL.Damage.PositiveValueRequired"));
});

test("damage uses the Contractor wound policy for both native sheets and assigned-class fallbacks", async t => {
  const previousActor = Actor, previousGet = game.settings.get;
  globalThis.Actor = class {};
  t.after(() => { globalThis.Actor = previousActor; game.settings.get = previousGet; });
  const { applyDamageToActors } = await import("../../scripts/apply-damage/apply-damage.js");
  const { QoLContractorSheet } = await import("../../scripts/sheets/contractor-sheet-class.js");
  const reads = [];
  game.settings.get = (module, key) => { reads.push([module, key]); return null; };
  for (const kind of ["instance", "flag", "creature"]) {
    for (const enabledScope of ["contractor", "creature"]) {
      reads.length = 0;
      const target = damageActor();
      target.type = "creature";
      target.sheet = kind === "instance" ? new QoLContractorSheet(target) : null;
      target.getFlag = () => kind === "flag" ? "mosh-greybearded-qol.QoLContractorSheet" : null;
      const result = await applyDamageToActors([target], { damage: 5, woundMetadata: { woundType: "bleeding" } }, {
        applyDamageConfig: { automateWoundRoll: { [enabledScope]: true } }
      });
      assert.equal(result, 1);
      const expectedScope = kind === "creature" ? "creature" : "contractor";
      assert.deepEqual(reads, enabledScope === expectedScope ? [["mosh", "table1eWoundBleeding"]] : []);
      assert.deepEqual(target.writes, [{ "system.health.value": 8, "system.hits.value": 0 }]);
    }
  }
});
