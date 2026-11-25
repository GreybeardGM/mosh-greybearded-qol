import test from "node:test";
import assert from "node:assert/strict";
import { getUniqueActorsFromTargets } from "../../scripts/apply-damage/target-logic.js";
import { canShowApplyDamageUI, resolveApplyDamageTargets } from "../../scripts/apply-damage/policy.js";

globalThis.Actor = class {
  constructor(id, uuid = `Actor.${id}`) { Object.assign(this, { id, uuid }); }
};
globalThis.foundry = { utils: { deepClone: structuredClone } };
let targetLogic, visibility;
globalThis.game = {
  user: {}, actors: new Map(),
  settings: { get: (_module, key) => key === "applyDamageTargetLogic" ? targetLogic : { visibility } }
};

test("linked tokens count once while separate synthetic Actors with the same base ID remain distinct", async () => {
  const linked = new Actor("base");
  const first = new Actor("base", "Scene.scene.Token.first.Actor.base");
  const second = new Actor("base", "Scene.scene.Token.second.Actor.base");
  const tokens = [linked, first, second, linked, first].map(actor => ({ actor }));
  assert.deepEqual(getUniqueActorsFromTargets(tokens), [linked, first, second]);
  targetLogic = "alwaysToken";
  assert.deepEqual(await resolveApplyDamageTargets(null, { controlledTokens: tokens }), [linked, first, second]);
  assert.deepEqual(await resolveApplyDamageTargets(null, { controlledTokens: new Set(tokens) }), [linked, first, second]);
});

test("target deduplication retains ID and object identity fallbacks", () => {
  const withoutUuid = { id: "old" }, objectOnly = {};
  assert.deepEqual(getUniqueActorsFromTargets([null, withoutUuid, { id: "old" }, objectOnly, objectOnly]), [withoutUuid, objectOnly]);
  assert.deepEqual(getUniqueActorsFromTargets({ actor: withoutUuid }), [withoutUuid]);
});

test("target preferences and explicit Actor inputs keep their established priority", async () => {
  const character = new Actor("character"), tokenActor = new Actor("token");
  const context = { user: { character }, controlledTokens: [{ actor: tokenActor }, { actor: tokenActor }, {}] };
  for (const [logic, expected] of [
    ["alwaysToken", [tokenActor]], ["tokenFirst", [tokenActor]],
    ["characterFirst", [character]], ["alwaysCharacter", [character]], ["unknown", [character]]
  ]) {
    targetLogic = logic;
    assert.deepEqual(await resolveApplyDamageTargets(null, context), expected);
    assert.deepEqual(await resolveApplyDamageTargets(character, context), [character]);
  }
  targetLogic = "tokenFirst";
  assert.deepEqual(await resolveApplyDamageTargets(null, { ...context, controlledTokens: [] }), [character]);
  targetLogic = "characterFirst";
  assert.deepEqual(await resolveApplyDamageTargets(null, { ...context, user: {} }), [tokenActor]);
});

test("visibility uses normalized config for disabled, GM, trusted and everyone cases", () => {
  const users = [{ isGM: true }, { isTrusted: true }, {}];
  for (const [setting, expected] of [
    ["disabled", [false, false, false]], ["gmOnly", [true, false, false]],
    ["trusted", [true, true, false]], ["everyone", [true, true, true]], ["invalid", [true, false, false]]
  ]) {
    visibility = setting;
    assert.deepEqual(users.map(user => canShowApplyDamageUI(user)), expected);
  }
});
