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

function contractorControls(actor) {
  const handlers = new Map();
  const record = (selector, callback) => {
    for (const name of selector.split(",").map(value => value.trim())) {
      if (!handlers.has(name)) handlers.set(name, []);
      handlers.get(name).push(callback);
    }
  };
  const html = {
    on: (_event, selector, callback) => record(selector, callback),
    find(selector) {
      return {
        on() { return this; }, each() { return this; },
        click: callback => record(selector, callback)
      };
    }
  };
  const sheet = new QoLContractorSheet(actor);
  sheet.options = { editable: true };
  sheet.activateListeners(html);
  return { sheet, handlers };
}

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
  const created = [], opened = [];
  const { handlers } = contractorControls({
    createEmbeddedDocuments: async (_type, items) => created.push(...items),
    getEmbeddedDocument: (_type, id) => ({ sheet: { render: force => opened.push([id, force]) } })
  });
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

test("Contractor counters patch only edited fields, preserving unrelated Item data", async () => {
  const cases = [
    [".treatment-button", { treatment: { value: 1, max: 3 } }, { "system.treatment.value": 2 }, { "system.treatment.value": 0 }],
    [".severity", { severity: 1, maxSeverity: 3 }, { "system.severity": 2 }, { "system.severity": 0 }],
    [".severity-button", { severity: 1, maxSeverity: 3 }, { "system.severity": 2 }, { "system.severity": 0 }],
    [".item-quantity", { quantity: 0 }, { "system.quantity": 1 }, { "system.quantity": -1 }],
    [".weapon-ammo", { ammo: 2 }, { "system.ammo": 3 }, { "system.ammo": 1 }],
    [".weapon-shots", { curShots: 1, shots: 3, ammo: 2 }, { "system.curShots": 2, "system.ammo": 1 }, { "system.curShots": 0, "system.ammo": 3 }],
    [".item-equip", { equipped: false }, { "system.equipped": true }, { "system.equipped": true }],
    [".armor-oxy", { oxygenCurrent: 1, oxygenMax: 3 }, { "system.oxygenCurrent": 2 }, { "system.oxygenCurrent": 0 }]
  ];
  for (const [selector, system, left, right] of cases) {
    for (const [button, expected] of [[0, left], [2, right]]) {
      const writes = [], original = structuredClone(system);
      const item = { id: "item", name: "Original", flags: { unrelated: true }, system: structuredClone(system),
        async update(patch) { writes.push(patch); } };
      const { handlers } = contractorControls({
        getEmbeddedDocument: () => item,
        updateEmbeddedDocuments() { assert.fail("Counters must not submit complete Item snapshots"); }
      });
      await handlers.get(selector)[0]({ button, preventDefault() {},
        currentTarget: { closest: () => ({ dataset: { itemId: item.id } }) } });
      assert.deepEqual(writes, [expected], `${selector}: button ${button}`);
      assert.deepEqual(item.system, original, "Do not mutate a live document before its update is accepted");
      assert.equal(item.name, "Original");
      assert.deepEqual(item.flags, { unrelated: true });
    }
  }
});

test("Contractor bounds and unrelated mouse buttons leave counters untouched", async () => {
  for (const [selector, system, button] of [
    [".treatment-button", { treatment: { value: 0, max: 3 } }, 2],
    [".treatment-button", { treatment: { value: 3, max: 3 } }, 0],
    [".severity", { severity: 0, maxSeverity: 3 }, 2],
    [".severity", { severity: 3, maxSeverity: 3 }, 0],
    [".weapon-ammo", { ammo: 0 }, 2],
    [".weapon-shots", { curShots: 3, shots: 3, ammo: 2 }, 0],
    [".weapon-shots", { curShots: 1, shots: 3, ammo: 0 }, 0],
    [".weapon-shots", { curShots: 0, shots: 3, ammo: 2 }, 2],
    [".armor-oxy", { oxygenCurrent: 0, oxygenMax: 3 }, 2],
    [".armor-oxy", { oxygenCurrent: 3, oxygenMax: 3 }, 0],
    ...[".treatment-button", ".severity", ".item-quantity", ".weapon-ammo", ".weapon-shots", ".armor-oxy"].map(selector => [selector, {}, 1])
  ]) {
    const { handlers } = contractorControls({ getEmbeddedDocument: () => ({ system,
      update() { assert.fail("No counter update expected"); }
    }) });
    await handlers.get(selector)[0]({ button, preventDefault() {},
      currentTarget: { closest: () => ({ dataset: { itemId: "item" } }) } });
  }
});
