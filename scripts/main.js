import { QoLContractorSheet } from "./sheets/contractor-sheet-class.js";
import { defineStashSheet } from "./sheets/stash-sheet-class.js";
import { convertStress } from "./shore-leave/convert-stress.js";
import { registerSettings } from "./settings/register-settings.js";
import { runReadyMigrations } from "./register/migrations.js";
import { SimpleShoreLeave } from "./shore-leave/simple-shore-leave.js";
import { triggerShipCrit } from "./ship-crits-0e.js";
import { upsertToolband, removeToolband } from "./toolband.js";
import { applyDamage } from "./apply-damage/apply-damage.js";
import { registerChatActions } from "./chat-actions.js";
import { registerApplyDamageSceneControl } from "./apply-damage/scene-control.js";
import { startCharacterCreation } from "./character-creator/character-creator.js";
import { registerDiceTerms } from "./dice.js";
import { registerModuleApi } from "./register/api.js";
import { capitalize, stripHtml } from "./utils/normalization.js";
import { setReady } from "./character-creator/progress.js";
import "./patches/creature-skillfix.js";

// Needs to be here to check for
let StashSheet;

/** Resolve a stable sheet "kind" identifier for toolbar behavior. */
function getSheetKind(sheet) {
  const actor = sheet?.actor;
  // Check explicit sheet classes first.
  if (sheet instanceof QoLContractorSheet) return "contractor";
  if (StashSheet && sheet instanceof StashSheet) return "stash";
  // Fallback: infer from actor type.
  if (actor?.type === "ship") return "ship";
  if (actor?.type === "character") return "character";
  if (actor?.type === "creature") return "creature";
  return "unknown";
}


// Register all the stuff
Hooks.once("ready", () => {
  
  Handlebars.registerHelper("eq", (a, b) => a === b);  
  Handlebars.registerHelper("array", (...args) => args.slice(0, -1));
  Handlebars.registerHelper("capitalize", str => capitalize(str));
  Handlebars.registerHelper("concat", (...args) => args.slice(0, -1).join(""));
  Handlebars.registerHelper("includes", function (collection, value) {
    if (Array.isArray(collection)) return collection.includes(value);
    if (collection instanceof Set) return collection.has(value);
    return false;
  });
  Handlebars.registerHelper("stripHtml", (text) => stripHtml(text));
  
  // Global registry for use in macros
  registerModuleApi({
    convertStress,
    SimpleShoreLeave,
    triggerShipCrit,
    startCharacterCreation,
    applyDamage
  });

  registerChatActions();

  // Register Stash Sheet
  const BaseSheet = CONFIG.Actor.sheetClasses.character["mosh.MothershipActorSheet"].cls;
  StashSheet = defineStashSheet(BaseSheet);

  // V13 Actors
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

  // Armor Broken Status Effect
  const customStatus = {
    id: "qol-broken-armor",
    name: "MoshQoL.Status.BrokenArmor",
    img: "modules/mosh-greybearded-qol/assets/icons/status/armor-broken.svg"
  };
  if (!CONFIG.statusEffects.some(e => e.id === customStatus.id)) {
    CONFIG.statusEffects.push(customStatus);
  }
  

});

// Settings
Hooks.once("init", () => {
  registerDiceTerms();
  registerSettings();
  // Bind scene-control hook early to avoid races during controls construction.
  registerApplyDamageSceneControl();
});

Hooks.once("ready", () => {
  runReadyMigrations();
});


// Sheet Header Buttons
Hooks.on("renderActorSheet", (sheet, html) => {
  const actor = sheet.actor;
  const isGM = game.user.isGM;
  const isOwner = actor?.testUserPermission?.(game.user, "OWNER") ?? false;
  if ( !isGM && !isOwner ) return;
  // Resolve the sheet kind and pass it to the helper.
  const kind = getSheetKind(sheet);
  // Always call upsert; helper logic decides visibility and available buttons.
  try {
    upsertToolband(sheet, html, { kind, isGM });
  } catch (e) {
    console.error(e);
  }
});

// Prepare fresh characters for Character Creation
Hooks.on("createActor", async (actor, options, userId) => {
  // Character actors only.
  if (actor.type !== "character") return;

  // Set the ready flag.
  await setReady(actor);
});

// Clean up toolband.
Hooks.on("closeActorSheet", (sheet) => {
  try { removeToolband(sheet); } catch (e) { console.error(e); }
});
