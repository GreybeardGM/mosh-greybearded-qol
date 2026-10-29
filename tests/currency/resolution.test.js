import test from "node:test";
import assert from "node:assert/strict";
import { resetFoundryEnvironment, dialogs, contexts, warnings, state } from "../helpers/foundry-environment.js";
import { actor } from "../currency/helpers.js";

const { classifyCurrency, formatCurrency } = await import("../../scripts/utils/currency-parser.js");
const { SETTING_CREDIT_HANDLER_CONFIG } = await import("../../scripts/codex/constants.js");
const { readCurrency } = await import("../../scripts/utils/currency.js");
const { payShoreLeave } = await import("../../scripts/chat-actions.js");

test.beforeEach(resetFoundryEnvironment);

test("numeric input, including zero, is passed through without UI", async () => {
  assert.equal(await readCurrency(123), 123);
  assert.equal(await readCurrency(0), 0);
  assert.equal(dialogs.length, 0);
});

test("only the configured world notation is read, with no ambiguity dialog", async () => {
  assert.equal(await readCurrency("10,123"), 10123);
  assert.equal(dialogs.length, 0);
  state.settings[SETTING_CREDIT_HANDLER_CONFIG] = { enabled: true, notation: "de" };
  state.responses = [{ input: "10,123 kcr" }];
  assert.equal(await readCurrency("10,123"), 10123);
  assert.deepEqual(dialogs[0].buttons.map(button => button.action), ["submit", "cancel"]);
  assert.equal(contexts[0].reason, "MoshQoL.Currency.Errors.fractional_credits");
  assert.equal(contexts[0].notationLabel, "MoshQoL.Currency.Notation.de");
});

test("invalid input remains prefilled across repeated corrections", async () => {
  state.responses = [{ input: "still wrong" }, { input: "1.234 kcr" }];
  assert.equal(await readCurrency("<bad>"), 1234);
  assert.deepEqual(contexts.map(context => context.raw), ["<bad>", "still wrong"]);
  assert.equal(contexts[0].reason, "MoshQoL.Currency.Errors.forbidden_character");
  assert.equal(dialogs[0].buttons.find(button => button.action === "submit").default, true);
});

test("Cancel, Escape/window close and unexpected responses abort correction", async () => {
  for (const input of ["invalid", "1.234"]) {
    for (const response of ["cancel", null, undefined, "unexpected"]) {
      state.responses = [response];
      assert.equal(await readCurrency(input), null);
    }
  }
});

test("world notation controls both API reads and display regardless of client language or handler", () => {
  game.i18n.lang = "de";
  assert.equal(classifyCurrency("1,234").value, 1234); // English remains the default.
  assert.equal(formatCurrency(1234567), "1,234,567 cr");
  for (const enabled of [true, false]) {
    state.settings[SETTING_CREDIT_HANDLER_CONFIG] = { enabled, notation: "fr" };
    assert.equal(classifyCurrency("1 234,5 kCR").value, 1234500);
    assert.equal(formatCurrency(1234567), "1\u202f234\u202f567 cr");
  }
  game.i18n.lang = "en";
});

test("changing world notation during correction aborts instead of reinterpreting the input", async () => {
  state.responses = [() => {
    state.settings[SETTING_CREDIT_HANDLER_CONFIG] = { enabled: true, notation: "de" };
    return { input: "1,234 kCR" };
  }];
  const target = actor("bad");
  await payShoreLeave(target, 100);
  assert.deepEqual(target.writes, []);
  assert.deepEqual(warnings, ["MoshQoL.Currency.Changed"]);
});
