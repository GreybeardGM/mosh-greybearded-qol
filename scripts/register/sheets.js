import { QoLContractorSheet } from "../sheets/contractor-sheet-class.js";
import { defineStashSheet } from "../sheets/stash-sheet-class.js";

let StashSheet;
let actorSheetsRegistered = false;

export function registerActorSheets() {
  if (actorSheetsRegistered) return;
  actorSheetsRegistered = true;

  const BaseSheet = CONFIG.Actor.sheetClasses.character["mosh.MothershipActorSheet"].cls;
  StashSheet = defineStashSheet(BaseSheet);

  const ActorsCollection = foundry.documents.collections.Actors;

  ActorsCollection.registerSheet("mosh-greybearded-qol", StashSheet, {
    types: ["character"],
    label: "MoshQoL.Sheets.Stash",
    makeDefault: false
  });

  ActorsCollection.registerSheet("mosh-greybearded-qol", QoLContractorSheet, {
    types: ["creature"],
    label: "MoshQoL.Sheets.Contractor",
    makeDefault: false
  });
}

export function getSheetKind(sheet) {
  const actor = sheet?.actor;

  if (sheet instanceof QoLContractorSheet) return "contractor";
  if (StashSheet && sheet instanceof StashSheet) return "stash";
  if (actor?.type === "ship") return "ship";
  if (actor?.type === "character") return "character";
  if (actor?.type === "creature") return "creature";

  return "unknown";
}
