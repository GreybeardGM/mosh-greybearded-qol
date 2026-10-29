import assert from "node:assert/strict";

// Mock Foundry boundaries only; feature tests import their real production code.
globalThis.Option = class { style = {}; };
export const dialogs = [], contexts = [], warnings = [], settingsWrites = [];
export const batchWrites = [];
export const state = { responses: [], settings: {}, rollTotal: 200 };
globalThis.HTMLElement = class {};
export const property = (object, path) => path.split(".").reduce((value, key) => value?.[key], object);
export const expandObject = flat => {
  const result = {};
  for (const [path, value] of Object.entries(flat)) {
    const parts = path.split(".");
    let target = result;
    for (const key of parts.slice(0, -1)) target = target[key] ??= {};
    target[parts.at(-1)] = value;
  }
  return result;
};
export class BaseSheet {
  constructor(actor) { this.actor = actor; this.object = actor; }
  async _updateObject(_event, data) { await this.actor.update(data); }
  getData() { return { data: { name: this.actor.name, system: structuredClone(this.actor.system) }, items: [] }; }
}
globalThis.foundry = {
  appv1: { sheets: { ActorSheet: BaseSheet } },
  applications: {
    api: {
      ApplicationV2: class { _onRender() {} render() { return this; } async close() { this.closed = true; } },
      HandlebarsApplicationMixin: Base => Base,
      DialogV2: {
        wait: async options => {
          dialogs.push(options);
          assert.ok(state.responses.length, "unexpected currency dialog");
          const response = state.responses.shift();
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
    get: (_module, key) => state.settings[key],
    set: async (...args) => settingsWrites.push(args)
  }
};
globalThis.ui = { windows: {}, notifications: { warn: value => warnings.push(value) } };
globalThis.Roll = class { total = state.rollTotal; async evaluate() { return this; } async toMessage() { return {}; } };

export function resetFoundryEnvironment() {
  dialogs.length = contexts.length = warnings.length = settingsWrites.length = 0;
  batchWrites.length = 0;
  state.responses = []; state.settings = {}; state.rollTotal = 200;
  game.user = { color: "#abcdef" };
  game.i18n.lang = "en";
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => ({}) };
  game.actors = { contents: [], get(id) { return this.contents.find(document => document.id === id); } };
  globalThis.Actor = { implementation: { updateDocuments: async updates => {
    batchWrites.push(structuredClone(updates));
    const documents = updates.map(update => game.actors.get(update._id));
    for (const [index, { _id, ...data }] of updates.entries()) await documents[index].update(data);
    return documents;
  } } };
}
