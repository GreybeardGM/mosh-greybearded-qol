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
    handlebars: { renderTemplate: async (_path, context) => { contexts.push(context); return "template"; } }
  },
  utils: { getProperty: property, expandObject, deepClone: structuredClone }
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

const { readCurrency } = await import("../../scripts/utils/currency.js");
const { payShoreLeave } = await import("../../scripts/chat-actions.js");
const { defineStashSheet } = await import("../../scripts/sheets/stash-sheet-class.js");
const { QoLContractorSheet } = await import("../../scripts/sheets/contractor-sheet-class.js");
const { TrainingConfigApp, getNormalizedTrainingConfig } = await import("../../scripts/settings/training-config.js");
const { TrainingSkillSelectorApp } = await import("../../scripts/training/select-training-skill.js");
const { rollLoadout } = await import("../../scripts/character-creator/roll-loadout.js");
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

test("ambiguous input offers both notations with exact candidate values", async () => {
  responses = ["en"];
  assert.equal(await readCurrency("10,123"), 10123);
  assert.deepEqual(dialogs[0].buttons.map(button => button.action), ["de", "en", "cancel"]);
  assert.equal(dialogs[0].modal, true);
  assert.equal(dialogs[0].rejectClose, false);
  assert.equal(dialogs[0].buttons.find(button => button.action === "cancel").default, true);
  assert.deepEqual(contexts[0].candidates.map(item => item.credits), ["10.123", "10123"]);
});

test("invalid input remains prefilled across repeated corrections, then resolves ambiguity", async () => {
  responses = [{ input: "still wrong" }, { input: "1,234 kcr" }, "de"];
  assert.equal(await readCurrency("<bad>"), 1234);
  assert.deepEqual(contexts.map(context => context.raw), ["<bad>", "still wrong", "1,234 kcr"]);
  assert.equal(contexts[0].reason, "MoshQoL.Currency.Errors.forbidden_character");
  assert.equal(dialogs[0].buttons.find(button => button.action === "submit").default, true);
});

test("choosing fractional Credits opens the correction dialog instead of changing notation", async () => {
  responses = ["de", { input: "10,123 kcr" }, "de"];
  assert.equal(await readCurrency("10,123"), 10123);
  assert.equal(contexts[1].raw, "10,123");
  assert.equal(contexts[1].reason, "MoshQoL.Currency.Errors.fractional_credits");
});

test("Cancel, Escape/window close and unexpected responses abort both dialog kinds", async () => {
  for (const input of ["invalid", "1,234"]) {
    for (const response of ["cancel", null, undefined, "unexpected"]) {
      responses = [response];
      assert.equal(await readCurrency(input), null);
    }
  }
});

test("cancelling a later correction keeps the original actor untouched", async () => {
  const target = actor("wrong");
  responses = [{ input: "1,234" }, "cancel"];
  await payShoreLeave(target, 200);
  assert.deepEqual(target.writes, []);
  assert.equal(target.system.credits.value, "wrong");
});

test("a cancelled or absent payable amount never becomes a zero or deducted payment", async () => {
  for (const amount of ["bad", "1,234", undefined]) {
    const target = actor(); responses = [null];
    await payShoreLeave(target, amount);
    assert.deepEqual(target.writes, []);
  }
});

test("resolved actor and manual payment amounts are used exactly once", async () => {
  const target = actor("1,5 MCR");
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
  const target = actor("1,234 kcr");
  responses = [() => { target.system.credits.value = 5000; return "de"; }];
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
    responses = [{ input: "1,5 Mcr" }];
    await sheet._updateObject(null, form);
    assert.equal(property(expandObject(form), path), 1500000);
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
    ["Actor.A", { ...actor("1,5 kcr"), documentName: "Actor", type: "creature" }],
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

test("cancelled roster calculations do not clean flags or commit subsequent edits", async () => {
  const member = { ...actor("bad"), documentName: "Actor", type: "creature" };
  globalThis.fromUuid = async () => member;
  let writes = 0;
  const ship = { getFlag: () => ({ creature: ["Actor.A"] }), setFlag: async () => writes++ };
  const app = new ShipCrewRosterApp({ actor: ship });
  responses = [null];
  const context = await app._prepareContext();
  assert.equal(context.currencyCancelled, true);
  assert.equal(app._lastRosterCleanupCandidate, null);
  assert.equal(await app._scheduleRosterCommit({}), false);
  assert.equal(writes, 0);
});

test("payroll overflow is detected before unsafe arithmetic can round the result", async () => {
  const member = { ...actor(Number.MAX_SAFE_INTEGER), documentName: "Actor", type: "creature" };
  globalThis.fromUuid = async () => member;
  responses = [null];
  assert.equal(await new ShipCrewRosterApp()._buildRosterContext({ creature: [{ uuid: "Actor.A", active: true, hazardPay: 2 }] }), null);
  assert.equal(contexts[0].raw, "18014398509481982");
  assert.equal(contexts[0].reason, "MoshQoL.Currency.Errors.integer_out_of_range");
});

test("rendering, focus and blur never normalize or replace editable currency text", () => {
  const handlers = {};
  const display = { style: {} };
  const input = { value: "1,234", style: {}, closest: () => ({ querySelector: () => display }) };
  const chain = { on: (name, handler) => { handlers[name] = handler; return chain; }, each: handler => { handler.call(input); return chain; } };
  attachCurrencyFieldHandlers({ find: () => chain });
  assert.equal(input.value, "1,234"); assert.equal(display.textContent, "1,234");
  handlers.focus.call(input); input.value = "<bad>"; handlers.blur.call(input);
  assert.equal(input.value, "<bad>"); assert.equal(display.textContent, "<bad>");
});
