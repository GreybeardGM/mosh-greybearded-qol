import test from "node:test";
import assert from "node:assert/strict";
import { resetFoundryEnvironment, state } from "../helpers/foundry-environment.js";


test.beforeEach(resetFoundryEnvironment);

test("Actor creation marks generator readiness only on the originating client, regardless of other owners or GMs", async t => {
  const previousHooks = globalThis.Hooks, previousUser = game.user;
  const hooks = new Map(), writes = [];
  globalThis.Hooks = { on: (name, callback) => hooks.set(name, callback) };
  t.after(() => { globalThis.Hooks = previousHooks; game.user = previousUser; });
  const { registerActorHooks } = await import("../../scripts/register/actor-hooks.js");
  registerActorHooks();
  const create = hooks.get("createActor");
  const target = { type: "character", setFlag: async (...args) => writes.push(args) };
  for (const user of [{ id: "creator" }, { id: "other-owner" }, { id: "gm", isGM: true }]) {
    game.user = user;
    await create(target, {}, "creator");
  }
  assert.deepEqual(writes, [["mosh-greybearded-qol", "greybeardCharacterCreation.ready", true]]);
  game.user = { id: "creator" };
  await create({ ...target, type: "creature" }, {}, "creator");
  assert.equal(writes.length, 1);

  state.settings.enableCharacterCreator = true;
  const live = new HTMLElement(), fragment = new HTMLElement();
  const toggles = [];
  live.classList = { toggle: (...args) => toggles.push(args) };
  fragment.classList = { toggle() { throw new Error("Unexpected fragment access"); } };
  const character = { type: "character", testUserPermission: () => false };
  for (const element of [live, [live]]) hooks.get("renderActorSheet")({ actor: character, element }, [fragment]);
  assert.deepEqual(toggles, [["qol-hide-system-character-config", true], ["qol-hide-system-character-config", true]]);
});
