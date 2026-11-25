import test from "node:test";
import assert from "node:assert/strict";
import { resetFoundryEnvironment, dialogs, contexts, state } from "../helpers/foundry-environment.js";
import { actor } from "../currency/helpers.js";

const { SETTING_CREDIT_HANDLER_CONFIG } = await import("../../scripts/codex/constants.js");
const { rollLoadout } = await import("../../scripts/character-creator/roll-loadout.js");
const { SimpleShoreLeave } = await import("../../scripts/shore-leave/simple-shore-leave.js");

test.beforeEach(resetFoundryEnvironment);

test("cancelling a rolled shore leave price emits no payment card", async () => {
  state.rollTotal = NaN; state.responses = [null];
  const app = { actor: actor(), _getTier: () => ({ priceFormula: "1d10", label: "Tier" }) };
  await SimpleShoreLeave._onRollPrice.call(app, null, { dataset: { tier: "X" } });
  assert.equal(contexts.length, 1); // Only the resolver, no chatOutput render.
  assert.equal(contexts[0].reason, "MoshQoL.Currency.Errors.not_finite");
});

test("disabled handler omits new payment buttons while character generation remains available", async () => {
  state.settings[SETTING_CREDIT_HANDLER_CONFIG] = { enabled: false, notation: "de" };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => ({}) };
  const target = actor();
  const app = { actor: target, _getTier: () => ({ priceFormula: "1d10", label: "Tier" }) };
  await SimpleShoreLeave._onRollPrice.call(app, null, { dataset: { tier: "X" } });
  assert.deepEqual(contexts[0].buttons.map(button => button.action), ["convertStress"]);
  assert.equal(contexts[0].blocks[0].value, "0,2 kcr");
  assert.equal(await rollLoadout(target, { system: {} }, { rollCredits: true }), true);
  assert.deepEqual(target.writes, [{ system: { credits: { value: "0,2 kcr" } } }]);
  assert.equal(dialogs.length, 0);
});
