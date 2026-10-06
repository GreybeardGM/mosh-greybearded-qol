import test from "node:test";
import assert from "node:assert/strict";

// Foundry boundaries are mocked; the real parser, resolver and callers run below.
globalThis.Option = class { style = {}; };
const dialogs = [], contexts = [], warnings = [], settingsWrites = [];
let responses = [], settings = {}, rollTotal = 200;
const property = (object, path) => path.split(".").reduce((value, key) => value?.[key], object);
const expandObject = flat => {
  const result = {};
  for (const [path, value] of Object.entries(flat)) {
    const parts = path.split(".");
    let target = result;
    for (const key of parts.slice(0, -1)) target = target[key] ??= {};
    target[parts.at(-1)] = value;
  }
  return result;
};
class BaseSheet {
  constructor(actor) { this.actor = actor; this.object = actor; }
  async _updateObject(_event, data) { await this.actor.update(data); }
  getData() { return { data: { name: this.actor.name, system: structuredClone(this.actor.system) }, items: [] }; }
}
globalThis.foundry = {
  appv1: { sheets: { ActorSheet: BaseSheet } },
  applications: {
    api: {
      ApplicationV2: class { _onRender() {} },
      HandlebarsApplicationMixin: Base => Base,
      DialogV2: {
        wait: async options => {
          dialogs.push(options);
          assert.ok(responses.length, "unexpected currency dialog");
          const response = responses.shift();
          if (typeof response === "function") return response(options);
          if (response && typeof response === "object") {
            return options.buttons.find(button => button.action === "submit").callback(null, {
              form: { elements: { currencyInput: { value: response.input } } }
            });
          }
          return response;
        }
      }
    },
    handlebars: { renderTemplate: async (_path, context) => { contexts.push(context); return "template"; } },
    ux: { TextEditor: { implementation: { enrichHTML: async value => value } } }
  },
  utils: { getProperty: property, expandObject, deepClone: structuredClone,
    escapeHTML: value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]) }
};
globalThis.game = {
  user: { color: "#abcdef" },
  i18n: { lang: "en", localize: key => key, format: key => key },
  settings: {
    get: (_module, key) => settings[key],
    set: async (...args) => settingsWrites.push(args)
  }
};
globalThis.ui = { notifications: { warn: value => warnings.push(value) } };
globalThis.Roll = class { total = rollTotal; async evaluate() { return this; } };

const { CreditHandlerConfigApp } = await import("../../scripts/settings/credit-handler-config.js");
const { classifyCurrency, formatCurrency } = await import("../../scripts/utils/currency-parser.js");
const { SETTING_CREDIT_HANDLER_CONFIG } = await import("../../scripts/codex/constants.js");
const { readCurrency } = await import("../../scripts/utils/currency.js");
const { payShoreLeave, refreshCreditPaymentButtons, registerChatActions } = await import("../../scripts/chat-actions.js");
const { defineStashSheet } = await import("../../scripts/sheets/stash-sheet-class.js");
const { QoLContractorSheet } = await import("../../scripts/sheets/contractor-sheet-class.js");
const { TrainingConfigApp, getNormalizedTrainingConfig } = await import("../../scripts/settings/training-config.js");
const { TrainingSkillSelectorApp } = await import("../../scripts/training/select-training-skill.js");
const { rollLoadout } = await import("../../scripts/character-creator/roll-loadout.js");
const { startCharacterCreation } = await import("../../scripts/character-creator/character-creator.js");
const { SimpleShoreLeave } = await import("../../scripts/shore-leave/simple-shore-leave.js");
const { ShipCrewRosterApp } = await import("../../scripts/ship-crew-roster.js");
const { attachCurrencyFieldHandlers } = await import("../../scripts/utils/currency-field.js");

test.beforeEach(() => {
  dialogs.length = contexts.length = warnings.length = settingsWrites.length = 0;
  responses = []; settings = {}; rollTotal = 200;
});
function actor(balance = 1000) {
  const writes = [];
  return {
    name: "Crewmember", writes, items: [{ id: "old", type: "item" }],
    system: { credits: { value: balance }, contractor: { baseSalary: balance } },
    update: async data => writes.push(data),
    deleteEmbeddedDocuments: async () => writes.push("delete"),
    createEmbeddedDocuments: async () => writes.push("create")
  };
}

test("numeric input, including zero, is passed through without UI", async () => {
  assert.equal(await readCurrency(123), 123);
  assert.equal(await readCurrency(0), 0);
  assert.equal(dialogs.length, 0);
});

test("only the configured world notation is read, with no ambiguity dialog", async () => {
  assert.equal(await readCurrency("10,123"), 10123);
  assert.equal(dialogs.length, 0);
  settings[SETTING_CREDIT_HANDLER_CONFIG] = { enabled: true, notation: "de" };
  responses = [{ input: "10,123 kcr" }];
  assert.equal(await readCurrency("10,123"), 10123);
  assert.deepEqual(dialogs[0].buttons.map(button => button.action), ["submit", "cancel"]);
  assert.equal(contexts[0].reason, "MoshQoL.Currency.Errors.fractional_credits");
  assert.equal(contexts[0].notationLabel, "MoshQoL.Currency.Notation.de");
});

test("invalid input remains prefilled across repeated corrections", async () => {
  responses = [{ input: "still wrong" }, { input: "1.234 kcr" }];
  assert.equal(await readCurrency("<bad>"), 1234);
  assert.deepEqual(contexts.map(context => context.raw), ["<bad>", "still wrong"]);
  assert.equal(contexts[0].reason, "MoshQoL.Currency.Errors.forbidden_character");
  assert.equal(dialogs[0].buttons.find(button => button.action === "submit").default, true);
});

test("Cancel, Escape/window close and unexpected responses abort correction", async () => {
  for (const input of ["invalid", "1.234"]) {
    for (const response of ["cancel", null, undefined, "unexpected"]) {
      responses = [response];
      assert.equal(await readCurrency(input), null);
    }
  }
});

test("cancelling a later correction keeps the original actor untouched", async () => {
  const target = actor("wrong");
  responses = [{ input: "1.234" }, "cancel"];
  await payShoreLeave(target, 200);
  assert.deepEqual(target.writes, []);
  assert.equal(target.system.credits.value, "wrong");
});

test("a cancelled or absent payable amount never becomes a zero or deducted payment", async () => {
  for (const amount of ["bad", "1.234", undefined]) {
    const target = actor(); responses = [null];
    await payShoreLeave(target, amount);
    assert.deepEqual(target.writes, []);
  }
});

test("resolved actor and manual payment amounts are used exactly once", async () => {
  const target = actor("1.5 MCR");
  await payShoreLeave(target, "250 kcr");
  assert.deepEqual(target.writes, [{ "system.credits.value": 1250000 }]);
});

test("insufficient funds and zero price do not write currency", async () => {
  const target = actor(100);
  await payShoreLeave(target, 101);
  await payShoreLeave(target, 0);
  assert.deepEqual(target.writes, []);
  assert.equal(warnings.length, 1);
});

test("balance changes while a dialog is open abort the pending payment", async () => {
  const target = actor("bad");
  responses = [() => { target.system.credits.value = 5000; return { input: "1.234 kcr" }; }];
  await payShoreLeave(target, 100);
  assert.deepEqual(target.writes, []);
  assert.deepEqual(warnings, ["MoshQoL.Currency.Changed"]);
});

test("duplicate clicks cannot deduct a stale balance during a slow save", async () => {
  const target = actor();
  let release, started;
  const pending = new Promise(resolve => { release = resolve; });
  const entered = new Promise(resolve => { started = resolve; });
  target.update = async data => { target.writes.push(data); started(); await pending; target.system.credits.value = data["system.credits.value"]; };
  const first = payShoreLeave(target, 100);
  await entered;
  await payShoreLeave(target, 100);
  release(); await first;
  assert.deepEqual(target.writes, [{ "system.credits.value": 900 }]);
  await payShoreLeave(target, 100);
  assert.equal(target.system.credits.value, 800);
});

test("failed payments release their guard so a subsequent action can run", async () => {
  const target = actor();
  target.update = async () => { throw new Error("save failed"); };
  await assert.rejects(payShoreLeave(target, 100), /save failed/);
  target.update = async data => target.writes.push(data);
  await payShoreLeave(target, 100);
  assert.equal(target.writes.length, 1);
});

test("stash and contractor forms cancel all fields and preserve pending edits", async () => {
  for (const [Sheet, path] of [[defineStashSheet(BaseSheet), "system.credits.value"], [QoLContractorSheet, "system.contractor.baseSalary"]]) {
    const target = actor(); const sheet = new Sheet(target);
    const form = { [path]: "bad", name: "New name" };
    responses = ["cancel"];
    await sheet._updateObject(null, form);
    assert.deepEqual(target.writes, []);
    assert.deepEqual(form, { [path]: "bad", name: "New name" });
    responses = [{ input: "1.5 Mcr" }];
    await sheet._updateObject(null, form);
    assert.equal(property(expandObject(form), path), "1.5 Mcr");
    assert.equal(target.writes.length, 1);
  }
});

test("form submissions do not overwrite a salary or balance changed during clarification", async () => {
  for (const [Sheet, path] of [[defineStashSheet(BaseSheet), "system.credits.value"], [QoLContractorSheet, "system.contractor.baseSalary"]]) {
    const target = actor(); const sheet = new Sheet(target);
    responses = [() => {
      if (path.includes("baseSalary")) target.system.contractor.baseSalary = 500;
      else target.system.credits.value = 500;
      return { input: "100" };
    }];
    await sheet._updateObject(null, { [path]: "bad" });
    assert.deepEqual(target.writes, []);
  }
});

test("training settings resolve every price before saving anything and remain open on cancellation", async () => {
  let closes = 0;
  const app = { close: () => closes++ };
  const formData = { object: { "training.prices.trained": "10k", "training.prices.expert": "bad", "training.prices.master": "200k" } };
  responses = [null];
  await TrainingConfigApp._onSubmit.call(app, null, null, formData);
  assert.deepEqual(settingsWrites, []); assert.equal(closes, 0);
  assert.equal(TrainingConfigApp.DEFAULT_OPTIONS.form.closeOnSubmit, false);
  responses = [{ input: "50k" }];
  await TrainingConfigApp._onSubmit.call(app, null, null, formData);
  assert.deepEqual(settingsWrites[0][2].prices, { trained: 10000, expert: 50000, master: 200000 });
  assert.equal(closes, 1);
});

test("stored invalid training prices are preserved and cancellation aborts skill selection before loading items", async () => {
  settings.trainingConfig = { prices: { trained: "bad" } };
  assert.equal(getNormalizedTrainingConfig().prices.trained, "bad");
  responses = [null];
  assert.equal(await TrainingSkillSelectorApp.wait({ actor: actor() }), null);
});

test("invalid rolled Credits cancelled before loadout cannot delete, create or update anything", async () => {
  rollTotal = 1.5; responses = [null];
  const target = actor();
  assert.equal(await rollLoadout(target, { system: {} }, { rollCredits: true, clearItems: true }), false);
  assert.deepEqual(target.writes, []);
});

test("cancelling a rolled shore leave price emits no payment card", async () => {
  rollTotal = NaN; responses = [null];
  const app = { actor: actor(), _getTier: () => ({ priceFormula: "1d10", label: "Tier" }) };
  await SimpleShoreLeave._onRollPrice.call(app, null, { dataset: { tier: "X" } });
  assert.equal(contexts.length, 1); // Only the resolver, no chatOutput render.
  assert.equal(contexts[0].reason, "MoshQoL.Currency.Errors.not_finite");
});

test("roster salaries use the interpreter and sum exactly without punctuation stripping", async () => {
  const actors = new Map([
    ["Actor.A", { ...actor("1.5 kcr"), documentName: "Actor", type: "creature" }],
    ["Actor.B", { ...actor(2500), documentName: "Actor", type: "creature" }]
  ]);
  globalThis.fromUuid = async uuid => actors.get(uuid);
  const app = new ShipCrewRosterApp();
  const context = await app._buildRosterContext({ creature: [
    { uuid: "Actor.A", active: true, hazardPay: 2 }, { uuid: "Actor.B", active: true, hazardPay: 3 }
  ] });
  assert.equal(context.summary.totalSalary, 4000);
  assert.equal(context.summary.totalHazardPay, 10500);
});

test("invalid salaries remain visible on repeated roster renders without dialogs or actor writes", async () => {
  const member = { ...actor("bad"), documentName: "Actor", type: "creature" };
  globalThis.fromUuid = async () => member;
  const ship = { getFlag: () => ({ creature: [{ uuid: "Actor.A", active: true, hazardPay: 2 }] }) };
  const app = new ShipCrewRosterApp({ actor: ship });
  for (let render = 0; render < 2; render++) {
    const context = await app._prepareContext();
    assert.equal(context.entries.creature[0].salary, "bad");
    assert.equal(context.summary.totalSalary, "MoshQoL.Currency.Unavailable");
    assert.equal(context.summary.totalHazardPay, "MoshQoL.Currency.Unavailable");
  }
  assert.equal(dialogs.length, 0);
  assert.deepEqual(member.writes, []);
  assert.equal(member.system.contractor.baseSalary, "bad");
});

test("payroll overflow never rounds or prompts for a manual replacement total", async () => {
  const member = { ...actor(Number.MAX_SAFE_INTEGER), documentName: "Actor", type: "creature" };
  globalThis.fromUuid = async () => member;
  const context = await new ShipCrewRosterApp()._buildRosterContext({ creature: [{ uuid: "Actor.A", active: true, hazardPay: 2 }] });
  assert.equal(context.summary.totalSalary, Number.MAX_SAFE_INTEGER);
  assert.equal(context.summary.totalHazardPay, null);
  assert.equal(dialogs.length, 0);
});

test("rendering, focus and blur never normalize or replace editable currency text", () => {
  const handlers = {};
  const display = { style: {} };
  const input = { value: "1,234", style: {}, closest: () => ({ querySelector: () => display }) };
  const chain = { on: (name, handler) => { handlers[name] = handler; return chain; }, each: handler => { handler.call(input); return chain; } };
  attachCurrencyFieldHandlers({ find: () => chain });
  assert.equal(input.value, "1,234"); assert.equal(display.textContent, "1,234 cr");
  handlers.focus.call(input); input.value = "<bad>"; handlers.blur.call(input);
  assert.equal(input.value, "<bad>"); assert.equal(display.textContent, "<bad>");
});

test("world notation controls both API reads and display regardless of client language or handler", () => {
  game.i18n.lang = "de";
  assert.equal(classifyCurrency("1,234").value, 1234); // English remains the default.
  assert.equal(formatCurrency(1234567), "1,234,567 cr");
  for (const enabled of [true, false]) {
    settings[SETTING_CREDIT_HANDLER_CONFIG] = { enabled, notation: "fr" };
    assert.equal(classifyCurrency("1 234,5 kCR").value, 1234500);
    assert.equal(formatCurrency(1234567), "1\u202f234\u202f567 cr");
  }
  game.i18n.lang = "en";
});

test("disabled handler never parses or pays, including calls from existing chat cards", async () => {
  settings[SETTING_CREDIT_HANDLER_CONFIG] = { enabled: false, notation: "en" };
  const target = actor("bad");
  await payShoreLeave(target, "also bad");
  assert.deepEqual(target.writes, []);
  assert.equal(dialogs.length, 0);
});

test("disabling the handler aborts payment but still allows a confirmed manual sheet correction", async () => {
  const target = actor("bad");
  responses = [() => {
    settings[SETTING_CREDIT_HANDLER_CONFIG] = { enabled: false, notation: "en" };
    return { input: "1000" };
  }];
  await payShoreLeave(target, 100);
  assert.deepEqual(target.writes, []);
  settings[SETTING_CREDIT_HANDLER_CONFIG].enabled = true;
  responses = [() => { settings[SETTING_CREDIT_HANDLER_CONFIG].enabled = false; return { input: "1000" }; }];
  await new (defineStashSheet(BaseSheet))(target)._updateObject(null, { "system.credits.value": "new bad entry" });
  assert.equal(target.writes[0]["system.credits.value"], "1000");
});

test("changing world notation during correction aborts instead of reinterpreting the input", async () => {
  responses = [() => {
    settings[SETTING_CREDIT_HANDLER_CONFIG] = { enabled: true, notation: "de" };
    return { input: "1,234 kCR" };
  }];
  const target = actor("bad");
  await payShoreLeave(target, 100);
  assert.deepEqual(target.writes, []);
  assert.deepEqual(warnings, ["MoshQoL.Currency.Changed"]);
});

test("manual edits are validated with automation off, preserving successful corrections as text", async () => {
  settings[SETTING_CREDIT_HANDLER_CONFIG] = { enabled: false, notation: "en" };
  for (const [Sheet, path] of [[defineStashSheet(BaseSheet), "system.credits.value"], [QoLContractorSheet, "system.contractor.baseSalary"]]) {
    const target = actor();
    responses = [{ input: "1.5 kCR" }];
    await new Sheet(target)._updateObject(null, { [path]: "manual invalid value" });
    const written = path.includes("baseSalary") ? property(target.writes[0], path) : target.writes[0][path];
    assert.equal(written, "1.5 kCR");
  }
  assert.equal(dialogs.length, 2);
});

test("stored Pay Up buttons hide immediately and on render, and restore when enabled", () => {
  const button = { hidden: false, style: {} };
  let selector;
  const root = { querySelectorAll: value => { selector = value; return [button]; } };
  settings[SETTING_CREDIT_HANDLER_CONFIG] = { enabled: false, notation: "en" };
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
  settings[SETTING_CREDIT_HANDLER_CONFIG].enabled = true;
  refreshCreditPaymentButtons(root);
  assert.equal(button.hidden, false);
  assert.equal(button.style.display, "");
});

test("disabled handler omits new payment buttons while character generation remains available", async () => {
  settings[SETTING_CREDIT_HANDLER_CONFIG] = { enabled: false, notation: "de" };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => ({}) };
  Roll.prototype.toMessage = async () => ({});
  const target = actor();
  const app = { actor: target, _getTier: () => ({ priceFormula: "1d10", label: "Tier" }) };
  await SimpleShoreLeave._onRollPrice.call(app, null, { dataset: { tier: "X" } });
  assert.deepEqual(contexts[0].buttons.map(button => button.action), ["convertStress"]);
  assert.equal(contexts[0].blocks[0].value, "0,2 kcr");
  assert.equal(await rollLoadout(target, { system: {} }, { rollCredits: true }), true);
  assert.deepEqual(target.writes, [{ system: { credits: { value: 200 } } }]);
  assert.equal(dialogs.length, 0);
});

test("character preparation intentionally resets Credits even when the handler is off", async () => {
  settings[SETTING_CREDIT_HANDLER_CONFIG] = { enabled: false, notation: "en" };
  const target = actor("unreadable old balance");
  target.getFlag = (_module, key) => key.endsWith(".ready") ? true : undefined;
  const preparation = new Error("stop after preparation payload");
  target.update = async data => { target.writes.push(data); throw preparation; };
  await assert.rejects(startCharacterCreation(target), preparation);
  assert.equal(target.writes[0].system.credits.value, 0);
  assert.equal(dialogs.length, 0);
});

test("disabling the handler during character generation does not suppress starting Credits", async () => {
  const target = actor(777);
  globalThis.fromUuid = async () => {
    settings[SETTING_CREDIT_HANDLER_CONFIG] = { enabled: false, notation: "en" };
    return { roll: async () => ({ results: [] }) };
  };
  assert.equal(await rollLoadout(target, { system: { roll_tables: { loadout: "table" } } }, { rollCredits: true }), true);
  assert.deepEqual(target.writes, [{ system: { credits: { value: 200 } } }]);
});

test("all starting Credit rolls overwrite old balances without notation conflicts, with the handler on or off", async () => {
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => ({}) };
  for (const notation of ["en", "de", "fr", "ch"]) {
    for (const enabled of [true, false]) {
      settings[SETTING_CREDIT_HANDLER_CONFIG] = { enabled, notation };
      for (rollTotal = 20; rollTotal <= 200; rollTotal += 10) {
        const target = actor("old value intentionally not parsed");
        assert.equal(await rollLoadout(target, { system: {} }, { rollCredits: true }), true);
        assert.deepEqual(target.writes, [{ system: { credits: { value: rollTotal } } }]);
      }
    }
  }
  assert.equal(dialogs.length, 0);
});

test("the generator exception still validates invalid rolls before any mutation", async () => {
  settings[SETTING_CREDIT_HANDLER_CONFIG] = { enabled: false, notation: "en" };
  for (const value of [NaN, Infinity, -20, 20.5, Number.MAX_SAFE_INTEGER + 1]) {
    rollTotal = value;
    responses = [null];
    const target = actor(777);
    assert.equal(await rollLoadout(target, { system: {} }, { rollCredits: true, clearItems: true }), false);
    assert.deepEqual(target.writes, []);
  }
});

test("loadouts without requested starting Credits never change a balance", async () => {
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => ({}) };
  for (const enabled of [true, false]) {
    settings[SETTING_CREDIT_HANDLER_CONFIG] = { enabled, notation: "en" };
    rollTotal = NaN; // No Credit roll is requested by contractor loadouts.
    const target = actor(777);
    assert.equal(await rollLoadout(target, { system: {} }, { rollCredits: false }), true);
    assert.deepEqual(target.writes, []);
  }
  assert.equal(dialogs.length, 0);
});

class SettingsRoot {
  constructor(select) { this.select = select; }
  querySelector() { return this.select; }
}
globalThis.HTMLElement = SettingsRoot;
async function creditMenu(notation = "en") {
  settings[SETTING_CREDIT_HANDLER_CONFIG] = { enabled: true, notation };
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
  responses = ["confirm"];
  select.value = "de";
  await select.listeners.change();
  assert.equal(dialogs.length, 1);
  assert.equal(dialogs[0].rejectClose, false);
  assert.equal(dialogs[0].buttons.find(button => button.action === "cancel").default, true);
  assert.equal(select.value, "de");
  assert.equal(select.disabled, false);
  assert.deepEqual(settingsWrites, []);
  assert.equal(settings[SETTING_CREDIT_HANDLER_CONFIG].notation, "en");
  await CreditHandlerConfigApp._onSubmit.call(app, null, null, { object: { enabled: false, notation: "de" } });
  assert.deepEqual(settingsWrites[0].slice(1), [SETTING_CREDIT_HANDLER_CONFIG, { enabled: false, notation: "de" }]);
  assert.equal(app.closed, true);
});

test("cancelling, closing or giving an unexpected warning response restores the previous selection", async () => {
  const { app, select } = await creditMenu("de");
  for (const response of ["cancel", null, undefined, "unexpected"]) {
    responses = [response]; select.value = "fr";
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
  responses = [() => new Promise(resolve => { release = resolve; })];
  select.value = "ch";
  const pending = select.listeners.change();
  await Promise.resolve();
  assert.equal(select.disabled, true);
  assert.equal(select.value, "de");
  await CreditHandlerConfigApp._onSubmit.call(app, null, null, { object: { enabled: true, notation: "ch" } });
  assert.deepEqual(settingsWrites, []);
  release("cancel"); await pending;
  const event = { preventDefault() {} };
  responses = ["cancel"];
  await CreditHandlerConfigApp._onResetDefaults.call(app, event);
  assert.equal(select.value, "de");
  assert.deepEqual(settingsWrites, []);
  responses = ["confirm"];
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
    settings[SETTING_CREDIT_HANDLER_CONFIG] = { enabled: false, notation: "en" };
    // Foundry can supply extra callback arguments; they must not be mistaken for a DOM root.
    definition.onChange(settings[SETTING_CREDIT_HANDLER_CONFIG], {}, "GM");
    assert.equal(button.hidden, true);
  } finally {
    globalThis.document = previousDocument;
  }
});

test("manual sheet edits preserve valid spelling in every notation even with automation off", async () => {
  for (const [notation, value] of Object.entries({ en: "1,234.5 kCr", de: "1.234,5 kCr", fr: "1 234,5 kCr", ch: "1'234.5 kCr" })) {
    for (const enabled of [true, false]) {
      settings[SETTING_CREDIT_HANDLER_CONFIG] = { enabled, notation };
      for (const [Sheet, path] of [[defineStashSheet(BaseSheet), "system.credits.value"], [QoLContractorSheet, "system.contractor.baseSalary"]]) {
        const target = actor();
        const form = { [path]: value };
        await new Sheet(target)._updateObject(null, form);
        assert.equal(form[path], value);
        const written = path.includes("baseSalary") ? property(target.writes[0], path) : target.writes[0][path];
        assert.equal(written, value);
      }
    }
  }
  assert.equal(dialogs.length, 0);
});

test("unchanged malformed, blank and numeric fields are omitted from unrelated sheet saves", async () => {
  for (const value of ["bad", "", null, undefined, 1234, 0]) {
    for (const [Sheet, path] of [[defineStashSheet(BaseSheet), "system.credits.value"], [QoLContractorSheet, "system.contractor.baseSalary"]]) {
      const target = actor(value);
      if (value === undefined) { delete target.system.credits.value; delete target.system.contractor.baseSalary; }
      const form = { [path]: String(value ?? ""), name: "Rename only" };
      await new Sheet(target)._updateObject(null, form);
      assert.equal(path in form, false);
      assert.equal(target.writes.length, 1);
      assert.equal(target.writes[0].name, "Rename only");
      const balance = path.includes("baseSalary") ? property(target.writes[0], path) : target.writes[0][path];
      assert.equal(balance, undefined);
    }
  }
  assert.equal(dialogs.length, 0);
});

test("confirmed repeated corrections update the editable field; cancelling preserves both field and actor", async () => {
  for (const [Sheet, path] of [[defineStashSheet(BaseSheet), "system.credits.value"], [QoLContractorSheet, "system.contractor.baseSalary"]]) {
    const target = actor("old malformed value");
    const sheet = new Sheet(target);
    const input = { defaultValue: "old malformed value", value: "new invalid value" };
    sheet.form = { elements: { namedItem: () => input } };
    const form = { [path]: input.value, name: "Pending rename" };
    responses = [{ input: "still bad" }, null];
    await sheet._updateObject(null, form);
    assert.deepEqual(target.writes, []);
    assert.equal(input.value, "new invalid value");
    assert.equal(form[path], "new invalid value");
    responses = [{ input: "still bad" }, { input: "1.5 kCR" }];
    await sheet._updateObject(null, form);
    assert.equal(input.value, "1.5 kCR");
    assert.equal(form[path], "1.5 kCR");
    assert.equal(target.writes.length, 1);
  }
});

test("stale forms never overwrite another user's currency with untouched or explicitly edited text", async () => {
  for (const [Sheet, path] of [[defineStashSheet(BaseSheet), "system.credits.value"], [QoLContractorSheet, "system.contractor.baseSalary"]]) {
    const target = actor(2000);
    const sheet = new Sheet(target);
    const input = { defaultValue: "1000", value: "1000" };
    sheet.form = { elements: { namedItem: () => input } };
    await sheet._updateObject(null, { [path]: "1000", name: "Rename" });
    assert.equal(target.writes.length, 1);
    assert.equal(path.includes("baseSalary") ? property(target.writes[0], path) : target.writes[0][path], undefined);
    target.writes.length = 0;
    input.value = "1500";
    await sheet._updateObject(null, { [path]: "1500", name: "Rename" });
    assert.deepEqual(target.writes, []);
  }
  assert.equal(dialogs.length, 0);
  assert.equal(warnings.length, 2);
});

test("contractor rendering preserves unknown fields and does not invent zero wages", async () => {
  for (const value of [null, undefined, "bad", "1.5 kCR", 0]) {
    const target = actor(value);
    if (value === undefined) delete target.system.contractor.baseSalary;
    target.system.contractor.extra = "preserve";
    const context = await new QoLContractorSheet(target).getData();
    assert.equal(context.system.contractor.baseSalary, value ?? "");
    assert.equal(context.system.contractor.extra, "preserve");
    assert.equal(target.system.contractor.baseSalary, value);
    assert.deepEqual(target.writes, []);
  }
  assert.equal(dialogs.length, 0);
});

test("inactive invalid wages do not spoil valid roster totals; active invalid wages never look like a partial sum", async () => {
  const actors = new Map([
    ["Actor.A", { ...actor("1.5 kCR"), documentName: "Actor", type: "creature" }],
    ["Actor.B", { ...actor("bad"), documentName: "Actor", type: "creature" }]
  ]);
  globalThis.fromUuid = async uuid => actors.get(uuid);
  const app = new ShipCrewRosterApp();
  for (const active of [false, true]) {
    const context = await app._buildRosterContext({ creature: [
      { uuid: "Actor.A", active: true, hazardPay: 2 }, { uuid: "Actor.B", active, hazardPay: 3 }
    ] });
    assert.equal(context.summary.totalSalary, active ? null : 1500);
    assert.equal(context.summary.totalHazardPay, active ? null : 3000);
    assert.equal(context.entries.creature.find(entry => entry.uuid === "Actor.B").salary, "bad");
  }
  assert.equal(dialogs.length, 0);
});
