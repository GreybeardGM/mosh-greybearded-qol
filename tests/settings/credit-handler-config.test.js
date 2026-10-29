import test from "node:test";
import assert from "node:assert/strict";
import { resetFoundryEnvironment, dialogs, settingsWrites, state } from "../helpers/foundry-environment.js";

const { CreditHandlerConfigApp } = await import("../../scripts/settings/credit-handler-config.js");
const { SETTING_CREDIT_HANDLER_CONFIG } = await import("../../scripts/codex/constants.js");

test.beforeEach(resetFoundryEnvironment);

class SettingsRoot extends HTMLElement {
  constructor(select) { super(); this.select = select; }
  querySelector() { return this.select; }
}
async function creditMenu(notation = "en") {
  state.settings[SETTING_CREDIT_HANDLER_CONFIG] = { enabled: true, notation };
  const select = { value: notation, disabled: false, listeners: {}, addEventListener(name, callback) { this.listeners[name] = callback; } };
  const app = new CreditHandlerConfigApp();
  app.element = new SettingsRoot(select);
  app.close = () => { app.closed = true; };
  app.render = () => { app.rendered = true; };
  await app._prepareContext();
  app._onRender({}, {});
  return { app, select };
}

test("currency dropdown warns on change, accepts only the confirmed draft and saves later", async () => {
  const { app, select } = await creditMenu();
  assert.equal(dialogs.length, 0);
  assert.equal(CreditHandlerConfigApp.DEFAULT_OPTIONS.form.closeOnSubmit, false);
  state.responses = ["confirm"];
  select.value = "de";
  await select.listeners.change();
  assert.equal(dialogs.length, 1);
  assert.equal(dialogs[0].rejectClose, false);
  assert.equal(dialogs[0].buttons.find(button => button.action === "cancel").default, true);
  assert.equal(select.value, "de");
  assert.equal(select.disabled, false);
  assert.deepEqual(settingsWrites, []);
  assert.equal(state.settings[SETTING_CREDIT_HANDLER_CONFIG].notation, "en");
  await CreditHandlerConfigApp._onSubmit.call(app, null, null, { object: { enabled: false, notation: "de" } });
  assert.deepEqual(settingsWrites[0].slice(1), [SETTING_CREDIT_HANDLER_CONFIG, { enabled: false, notation: "de" }]);
  assert.equal(app.closed, true);
});

test("cancelling, closing or giving an unexpected warning response restores the previous selection", async () => {
  const { app, select } = await creditMenu("de");
  for (const response of ["cancel", null, undefined, "unexpected"]) {
    state.responses = [response]; select.value = "fr";
    await select.listeners.change();
    assert.equal(select.value, "de");
    assert.equal(app._notation, "de");
    assert.equal(select.disabled, false);
    assert.deepEqual(settingsWrites, []);
  }
});

test("saving cannot bypass an open warning, and reset also requires notation confirmation", async () => {
  const { app, select } = await creditMenu("de");
  let release;
  state.responses = [() => new Promise(resolve => { release = resolve; })];
  select.value = "ch";
  const pending = select.listeners.change();
  await Promise.resolve();
  assert.equal(select.disabled, true);
  assert.equal(select.value, "de");
  await CreditHandlerConfigApp._onSubmit.call(app, null, null, { object: { enabled: true, notation: "ch" } });
  assert.deepEqual(settingsWrites, []);
  release("cancel"); await pending;
  const event = { preventDefault() {} };
  state.responses = ["cancel"];
  await CreditHandlerConfigApp._onResetDefaults.call(app, event);
  assert.equal(select.value, "de");
  assert.deepEqual(settingsWrites, []);
  state.responses = ["confirm"];
  await CreditHandlerConfigApp._onResetDefaults.call(app, event);
  assert.equal(select.value, "en");
  assert.deepEqual(settingsWrites[0][2], { enabled: true, notation: "en" });
});

test("Credit Handler registration is GM-only, world scoped and enabled with English by default", async () => {
  const registered = [], menus = [];
  game.settings.register = (...args) => registered.push(args);
  game.settings.registerMenu = (...args) => menus.push(args);
  const { registerSettings } = await import("../../scripts/settings/register-settings.js");
  registerSettings();
  // Assert the public IDs literally: centralization must not rename existing menus or change their order/icons.
  assert.deepEqual(menus.map(entry => [entry[1], entry[2].icon]), [
    ["toolbandConfigMenu", "fas fa-toolbox"],
    ["applyDamageConfigMenu", "fas fa-heart-broken"],
    ["shoreLeaveEditor", "fas fa-umbrella-beach"],
    ["trainingConfigMenu", "fa-solid fa-dumbbell"],
    ["creditHandlerConfigMenu", "fa-solid fa-coins"],
    ["cyberwareConfigMenu", "fa-solid fa-microchip"]
  ]);
  const definition = registered.find(entry => entry[1] === SETTING_CREDIT_HANDLER_CONFIG)[2];
  assert.equal(definition.scope, "world");
  assert.equal(definition.config, false);
  assert.deepEqual(definition.default, { enabled: true, notation: "en" });
  const menu = menus.find(entry => entry[2].type === CreditHandlerConfigApp)[2];
  assert.equal(menu.restricted, true);
  const button = { style: {} };
  const previousDocument = globalThis.document;
  globalThis.document = { querySelectorAll: () => [button] };
  try {
    state.settings[SETTING_CREDIT_HANDLER_CONFIG] = { enabled: false, notation: "en" };
    // Foundry can supply extra callback arguments; they must not be mistaken for a DOM root.
    definition.onChange(state.settings[SETTING_CREDIT_HANDLER_CONFIG], {}, "GM");
    assert.equal(button.hidden, true);
  } finally {
    globalThis.document = previousDocument;
  }
});
