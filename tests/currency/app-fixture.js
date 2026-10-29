import { BaseSheet } from "../helpers/foundry-environment.js";
import { actor } from "./helpers.js";

const { CreditsApp } = await import("../../scripts/currency/credits-app.js");
const { registerActorSheets } = await import("../../scripts/register/sheets.js");

let RegisteredStashSheet;
globalThis.CONFIG = { Actor: { sheetClasses: { character: { "mosh.MothershipActorSheet": { cls: BaseSheet } } } } };
foundry.documents = { collections: { Actors: { registerSheet: (_module, cls, options) => {
  if (options.types.includes("character")) RegisteredStashSheet = cls;
} } } };
registerActorSheets();

export function creditApp(balance, inputValue, { target = actor(balance, { persist: true }) } = {}) {
  const app = new CreditsApp({ actor: target });
  const input = { value: inputValue, readOnly: false };
  const buttons = [{ disabled: false }, { disabled: false }];
  const stashSelect = { value: "", disabled: false }, transferSelect = { value: "", disabled: false };
  app.form = {
    elements: { namedItem: name => ({ creditAmount: input, stashActor: stashSelect, transferActor: transferSelect })[name] },
    querySelectorAll: () => [...buttons, stashSelect, transferSelect]
  };
  const receipts = [];
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async data => { receipts.push(data); } };
  return { app, target, input, buttons, receipts, stashSelect, transferSelect };
}

export const bookCredits = (app, operation) => CreditsApp._onTransaction.call(app, null, { dataset: { action: operation } });

export function worldCreditActor(id, balance, { stash = false, isOwner = true, hasPlayerOwner = true, type = "character" } = {}) {
  const document = Object.assign(actor(balance, { persist: true }), { id, uuid: `Actor.${id}`, name: id, type, isOwner, hasPlayerOwner });
  document.sheet = stash ? new RegisteredStashSheet(document) : new BaseSheet(document);
  game.actors.contents.push(document);
  return document;
}

export function stashApp(balance = "8k", stashBalance = "2k", input = "1k") {
  const source = worldCreditActor("source", balance);
  const stash = worldCreditActor("stash", stashBalance, { stash: true });
  const fixture = creditApp(balance, input, { target: source });
  fixture.stashSelect.value = stash.id;
  return { ...fixture, stash };
}
