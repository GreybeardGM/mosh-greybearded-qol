import test from "node:test";
import assert from "node:assert/strict";
import { resetFoundryEnvironment, contexts, state } from "../helpers/foundry-environment.js";
import { actor } from "../currency/helpers.js";

const { classifyCurrency } = await import("../../scripts/utils/currency-parser.js");
const { SETTING_CREDIT_HANDLER_CONFIG } = await import("../../scripts/codex/constants.js");
const { payShoreLeave, refreshCreditPaymentButtons, registerChatActions } = await import("../../scripts/chat-actions.js");
const { SimpleShoreLeave } = await import("../../scripts/shore-leave/simple-shore-leave.js");

test.beforeEach(resetFoundryEnvironment);

test("stored chat action IDs still dispatch, while Pay Up buttons follow the handler setting", async t => {
  const previousHooks = globalThis.Hooks, previousElement = globalThis.Element;
  const previousApi = game.moshGreybeardQol, previousCharacter = game.user.character;
  t.after(() => { globalThis.Hooks = previousHooks; globalThis.Element = previousElement;
    game.moshGreybeardQol = previousApi; game.user.character = previousCharacter; });
  const button = { hidden: false, style: {} };
  let selector;
  const root = { querySelectorAll: value => { selector = value; return [button]; } };
  state.settings[SETTING_CREDIT_HANDLER_CONFIG] = { enabled: false, notation: "en" };
  refreshCreditPaymentButtons(root);
  assert.ok(selector.includes('data-action="payShoreLeave"'));
  assert.equal(button.hidden, true);
  assert.equal(button.style.display, "none");
  const callbacks = {};
  globalThis.Hooks = { on: (name, callback) => { callbacks[name] = callback; } };
  registerChatActions();
  root.dataset = { moshQolChatActionsBound: "true" };
  callbacks.renderChatMessageHTML({}, root);
  assert.equal(button.hidden, true);
  state.settings[SETTING_CREDIT_HANDLER_CONFIG].enabled = true;
  refreshCreditPaymentButtons(root);
  assert.equal(button.hidden, false);
  assert.equal(button.style.display, "");

  state.settings.applyDamageConfig = { visibility: "everyone" };
  globalThis.Element = class {};
  const calls = [], target = actor(1000, { persist: true });
  game.user.character = target;
  game.moshGreybeardQol = {
    applyDamage: (...args) => calls.push(["damage", ...args]),
    convertStress: (...args) => calls.push(["stress", ...args]),
    SimpleShoreLeave: { wait: options => calls.push(["shore", options]) },
    triggerShipCrit: (...args) => calls.push(["crit", ...args])
  };
  let click;
  Object.assign(root, { dataset: {}, contains: () => true, querySelector: () => ({}),
    addEventListener: (_name, callback) => { click = callback; } });
  callbacks.renderChatMessageHTML({}, root);
  // Literal wire values stand for already stored content, independently of the new constants.
  for (const [action, args] of [
    ["applyDamageSelected", [7, true, "Gunshot", "advantage"]], ["convertStress", ["1d5"]],
    ["simpleShoreLeave", [false]], ["triggerShipCrit", [10, "Actor.ship"]], ["payShoreLeave", [100]]
  ]) {
    const node = Object.assign(new Element(), { closest: () => ({ dataset: { action, args: JSON.stringify(args) } }) });
    await click({ target: node, preventDefault() {} });
  }
  assert.deepEqual(calls, [
    ["damage", null, 7, true, "Gunshot", "advantage"], ["stress", target, "1d5"],
    ["shore", { actor: target, randomFlavor: false }], ["crit", 10, "Actor.ship"]
  ]);
  assert.equal(classifyCurrency(target.system.credits.value).value, 900);
  const { chatOutput } = await import("../../scripts/utils/chat-output.js");
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => ({}) };
  await chatOutput({ actor: target, title: "Credits", icon: "fa-coins", buttons: [{ action: "payShoreLeave", args: [100] }] });
  assert.equal(contexts.at(-1).chatActionClass, "chat-action");
  assert.equal(contexts.at(-1).buttons[0].action, "payShoreLeave");
});
