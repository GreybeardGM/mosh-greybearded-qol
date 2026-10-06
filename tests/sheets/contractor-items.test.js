import test from "node:test";
import assert from "node:assert/strict";

// Only sheet/Application bases are needed to load the real Contractor methods.
globalThis.Option = class { style = {}; };
globalThis.foundry = {
  appv1: { sheets: { ActorSheet: class { constructor(actor) { this.actor = actor; } } } },
  applications: { api: {
    ApplicationV2: class {},
    HandlebarsApplicationMixin: Base => Base
  } }
};
globalThis.CONST = { DEFAULT_TOKEN: "icons/svg/mystery-man.svg" };

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
