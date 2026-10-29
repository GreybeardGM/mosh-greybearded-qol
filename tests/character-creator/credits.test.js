import test from "node:test";
import assert from "node:assert/strict";
import { resetFoundryEnvironment, dialogs, state } from "../helpers/foundry-environment.js";
import { actor } from "../currency/helpers.js";

const { classifyCurrency, formatCurrency } = await import("../../scripts/utils/currency-parser.js");
const { SETTING_CREDIT_HANDLER_CONFIG } = await import("../../scripts/codex/constants.js");
const { rollLoadout } = await import("../../scripts/character-creator/roll-loadout.js");
const { startCharacterCreation } = await import("../../scripts/character-creator/character-creator.js");

test.beforeEach(resetFoundryEnvironment);

test("invalid rolled Credits cancelled before loadout cannot delete, create or update anything", async () => {
  state.rollTotal = 1.5; state.responses = [null];
  const target = actor();
  assert.equal(await rollLoadout(target, { system: {} }, { rollCredits: true, clearItems: true }), false);
  assert.deepEqual(target.writes, []);
});

test("character preparation intentionally resets Credits even when the handler is off", async () => {
  state.settings[SETTING_CREDIT_HANDLER_CONFIG] = { enabled: false, notation: "en" };
  const target = actor("unreadable old balance");
  target.getFlag = (_module, key) => key.endsWith(".ready") ? true : undefined;
  const preparation = new Error("stop after preparation payload");
  target.update = async data => { target.writes.push(data); throw preparation; };
  await assert.rejects(startCharacterCreation(target), preparation);
  assert.equal(target.writes[0].system.credits.value, "0 cr");
  assert.equal(dialogs.length, 0);
});

test("disabling the handler during character generation does not suppress starting Credits", async () => {
  const target = actor(777);
  globalThis.fromUuid = async () => {
    state.settings[SETTING_CREDIT_HANDLER_CONFIG] = { enabled: false, notation: "en" };
    return { roll: async () => ({ results: [] }) };
  };
  assert.equal(await rollLoadout(target, { system: { roll_tables: { loadout: "table" } } }, { rollCredits: true }), true);
  assert.deepEqual(target.writes, [{ system: { credits: { value: "0.2 kcr" } } }]);
});

test("all starting Credit rolls overwrite old balances without notation conflicts, with the handler on or off", async () => {
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => ({}) };
  for (const notation of ["en", "de", "fr", "ch"]) {
    for (const enabled of [true, false]) {
      state.settings[SETTING_CREDIT_HANDLER_CONFIG] = { enabled, notation };
      for (state.rollTotal = 20; state.rollTotal <= 200; state.rollTotal += 10) {
        const target = actor("old value intentionally not parsed");
        assert.equal(await rollLoadout(target, { system: {} }, { rollCredits: true }), true);
        assert.deepEqual(target.writes, [{ system: { credits: { value: formatCurrency(state.rollTotal) } } }]);
        assert.equal(classifyCurrency(target.writes[0].system.credits.value).value, state.rollTotal);
      }
    }
  }
  assert.equal(dialogs.length, 0);
});

test("the generator exception still validates invalid rolls before any mutation", async () => {
  state.settings[SETTING_CREDIT_HANDLER_CONFIG] = { enabled: false, notation: "en" };
  for (const value of [NaN, Infinity, 20.5, Number.MAX_SAFE_INTEGER + 1]) {
    state.rollTotal = value;
    state.responses = [null];
    const target = actor(777);
    assert.equal(await rollLoadout(target, { system: {} }, { rollCredits: true, clearItems: true }), false);
    assert.deepEqual(target.writes, []);
  }
});

test("loadouts without requested starting Credits never change a balance", async () => {
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => ({}) };
  for (const enabled of [true, false]) {
    state.settings[SETTING_CREDIT_HANDLER_CONFIG] = { enabled, notation: "en" };
    state.rollTotal = NaN; // No Credit roll is requested by contractor loadouts.
    const target = actor(777);
    assert.equal(await rollLoadout(target, { system: {} }, { rollCredits: false }), true);
    assert.deepEqual(target.writes, []);
  }
  assert.equal(dialogs.length, 0);
});
