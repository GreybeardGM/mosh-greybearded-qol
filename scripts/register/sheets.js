import { MODULE_ID } from "../codex/constants.js";
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

  ActorsCollection.registerSheet(MODULE_ID, StashSheet, {
    types: ["character"],
    label: "MoshQoL.Sheets.Stash",
    makeDefault: false
  });

  ActorsCollection.registerSheet(MODULE_ID, QoLContractorSheet, {
    types: ["creature"],
    label: "MoshQoL.Sheets.Contractor",
    makeDefault: false
  });
}

export function getSheetKind(sheet, actor = sheet?.actor) {
  if (sheet instanceof QoLContractorSheet) return "contractor";
  if (StashSheet && sheet instanceof StashSheet) return "stash";
  if (actor?.type === "ship") return "ship";
  if (actor?.type === "character") return "character";
  if (actor?.type === "creature") {
    // Damage processing also needs the assigned class when no sheet instance is available.
    const sheetClass = actor.getFlag?.("core", "sheetClass");
    return typeof sheetClass === "string" && sheetClass.includes(QoLContractorSheet.name)
      ? "contractor" : "creature";
  }

  return "unknown";
}
