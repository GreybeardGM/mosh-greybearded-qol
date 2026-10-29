import test from "node:test";
import assert from "node:assert/strict";

// Only sheet/Application bases are needed to load the real Contractor methods.
globalThis.Option = class { style = {}; };
globalThis.foundry = {
  appv1: { sheets: { ActorSheet: class { constructor(actor) { this.actor = actor; } activateListeners() {} } } },
  applications: { api: {
    ApplicationV2: class {},
    HandlebarsApplicationMixin: Base => Base
  } }
};
globalThis.CONST = { DEFAULT_TOKEN: "icons/svg/mystery-man.svg" };
globalThis.game = { user: { isGM: true }, i18n: { localize: key => key } };
let choice;
const dialogs = [];
foundry.applications.api.DialogV2 = { wait: async options => { dialogs.push(options); return choice; } };
test.beforeEach(() => { choice = null; dialogs.length = 0; game.user.isGM = true; });

const { QoLContractorSheet } = await import("../../scripts/sheets/contractor-sheet-class.js");

test("Contractor creation preserves button defaults in the current Item schema", async () => {
  const dataset = { type: "item", quantity: "2", description: "Crew supplies" };
  const sheet = new QoLContractorSheet({
    // Simulate a current document boundary: legacy data is not system data.
    createEmbeddedDocuments: async (_type, entries) => entries.map(entry => ({
      name: entry.name, type: entry.type, system: entry.system ?? {}
    }))
  });
  const [created] = await sheet._onItemCreate({
    preventDefault() {}, currentTarget: { dataset }
  });

  assert.equal(created.system.quantity, "2");
  assert.equal(created.system.description, "Crew supplies");
  assert.equal(created.type, "item");
  assert.equal(created.name, "New Item");
  assert.equal(Object.hasOwn(created.system, "type"), false);
  assert.equal(dataset.type, "item");
});

test("Contractor inventory renders an item without artwork using Foundry's fallback", () => {
  const item = { type: "item", system: {} };
  const sheetData = { data: { system: {} }, items: [item] };

  new QoLContractorSheet({})._prepareContractorItems(sheetData);

  assert.equal(sheetData.data.gear[0].img, CONST.DEFAULT_TOKEN);
});

test("inventory, skill and weapon controls each create or open their own item exactly once", async () => {
  const handlers = new Map(), created = [], opened = [];
  const html = {
    on() {},
    find(selector) {
      return {
        on() { return this; }, each() { return this; },
        click(callback) {
          for (const name of selector.split(",").map(value => value.trim())) {
            if (!handlers.has(name)) handlers.set(name, []);
            handlers.get(name).push(callback);
          }
        }
      };
    }
  };
  const sheet = new QoLContractorSheet({
    createEmbeddedDocuments: async (_type, items) => created.push(...items),
    getEmbeddedDocument: (_type, id) => ({ sheet: { render: force => opened.push([id, force]) } })
  });
  sheet.options = { editable: true };
  sheet.activateListeners(html);
  for (const [prefix, type] of [["item", "item"], ["skill", "skill"], ["weapon", "weapon"]]) {
    for (const action of ["create", "edit"]) {
      const callbacks = handlers.get(`.${prefix}-${action}`);
      assert.equal(callbacks.length, 1);
      await callbacks[0]({ preventDefault() {}, currentTarget: {
        dataset: { type }, closest: () => ({ dataset: { itemId: type } })
      } });
    }
  }
  assert.deepEqual(created.map(item => item.type), ["item", "skill", "weapon"]);
  assert.deepEqual(opened, [["item", true], ["skill", true], ["weapon", true]]);
});

test("Contractor promotion preserves roll, manual and cancellation choices", async () => {
  for (const answer of ["roll", "manual", "cancel", null]) {
    choice = answer;
    const updates = [], rolls = [];
    const sheet = new QoLContractorSheet({ update: async data => updates.push(data) });
    sheet.render = () => {};
    for (const name of ["Loyalty", "Motivation", "Loadout"]) {
      sheet[`_rollContractor${name}`] = async actor => { assert.equal(actor, sheet.actor); rolls.push(name); };
    }
    await sheet.promoteContractor();
    assert.equal(updates.length, answer === "roll" || answer === "manual" ? 1 : 0);
    if (updates.length) assert.deepEqual(updates[0], { "system.contractor.isNamed": true, "system.stats.loyalty.enabled": true });
    assert.deepEqual(rolls, answer === "roll" ? ["Loyalty", "Motivation", "Loadout"] : []);
  }
});

test("Contractor menu rolls only the chosen detail; both actions remain GM-only", async () => {
  const sheet = new QoLContractorSheet({}), rolls = [];
  for (const name of ["Loyalty", "Motivation", "Loadout"]) sheet[`_rollContractor${name}`] = async () => rolls.push(name);
  await sheet.openContractorMenu();
  const buttons = dialogs[0].buttons;
  for (const [index, expected] of ["Loyalty", "Motivation", "Loadout"].entries()) {
    await buttons[index].callback();
    assert.deepEqual(rolls.splice(0), [expected]);
  }
  game.user.isGM = false;
  await sheet.promoteContractor();
  await sheet.openContractorMenu();
  assert.equal(dialogs.length, 1);
});
