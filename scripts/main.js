import { QoLContractorSheet } from "./contractor-sheet-class.js";
import { defineStashSheet } from "./stash-sheet-class.js";
import { convertStress } from "./convert-stress.js";
import { ShoreLeaveTierEditor } from "./ui/edit-shore-leave-tiers.js";
import { simpleShoreLeave } from "./simple-shore-leave.js";
import { SHORE_LEAVE_TIERS } from "./config/default-shore-leave-tiers.js";
import { triggerShipCrit } from "./ship-crits-0e.js";
import { upsertToolband, removeToolband } from "./toolband.js";
import { applyDamage } from "./utils/apply-damage.js";
import { startCharacterCreation } from "./character-creator/character-creator.js";
import {
  checkReady,
  checkCompleted,
  setReady,
  setCompleted,
  reset
} from "./character-creator/progress.js";

// Needs to be here to check for
let StashSheet;

/** Ermittelt einen stabilen Sheet-„Kind“-Identifier für die Toolbar-Logik */
function getSheetKind(sheet) {
  const actor = sheet?.actor;
  // Konkrete Klassen zuerst prüfen
  try { if (sheet instanceof QoLContractorSheet) return "contractor"; } catch {}
  try { if (sheet instanceof StashSheet) return "stash"; } catch {}
  // Generisch über Actor-Typ
  if (actor?.type === "ship") return "ship";
  if (actor?.type === "character") return "character";
  if (actor?.type === "creature") return "creature";
  return "unknown";
}

// Register all the stuff
Hooks.once("ready", () => {
  
  Handlebars.registerHelper("eq", (a, b) => a === b);  
  Handlebars.registerHelper("array", (...args) => args.slice(0, -1));
  Handlebars.registerHelper("capitalize", str => str.charAt(0).toUpperCase() + str.slice(1));
  Handlebars.registerHelper("includes", function (collection, value) {
    if (Array.isArray(collection)) return collection.includes(value);
    if (collection instanceof Set) return collection.has(value);
    return false;
  });
  Handlebars.registerHelper("stripHtml", (text) => {
    return typeof text === "string" ? text.replace(/<[^>]*>/g, "").trim() : "";
  });
  
  // Global registry for use in macros
  game.moshGreybeardQol = game.moshGreybeardQol || {};
  game.moshGreybeardQol.convertStress = convertStress;
  game.moshGreybeardQol.simpleShoreLeave = simpleShoreLeave;
  game.moshGreybeardQol.triggerShipCrit = triggerShipCrit;
  game.moshGreybeardQol.startCharacterCreation = startCharacterCreation;
  game.moshGreybeardQol.applyDamage = applyDamage;

  // Register Stash Sheet
  const BaseSheet = CONFIG.Actor.sheetClasses.character["mosh.MothershipActorSheet"].cls;
  StashSheet = defineStashSheet(BaseSheet);

  // V13 Actors
  const ActorsCollection = foundry.documents.collections.Actors;
  
  ActorsCollection.registerSheet("mosh-greybearded-qol", StashSheet, {
    types: ["character"],
    label: "Stash Sheet",
    makeDefault: false
  });

  ActorsCollection.registerSheet("mosh-greybearded-qol", QoLContractorSheet, {
    types: ["creature"],
    label: "Contractor Sheet",
    makeDefault: false
  });
  
  // Debug Check
  console.log("✅ MoSh Greybearded QoL loaded");  
});

// Settings
Hooks.once("init", () => {
  // Theme Colors
  game.settings.register("mosh-greybearded-qol", "themeColor", {
    name: "Global Theme Color",
    hint: "If set, this will override the player colors.",
    scope: "world",
    config: true,
    type: String,
    default: "#f50"
  });

  game.settings.register("mosh-greybearded-qol", "themeColorOverride", {
    name: "Player Theme Color",
    hint: "If set, this will override the default color for this user.",
    scope: "client",
    config: true,
    type: String,
    default: ""
  });

  // Config Stress Conversion
  game.settings.register("mosh-greybearded-qol", "convertStress.noSanitySave", {
    name: "No Sanity Save",
    hint: "If enabled, stress will be converted without a sanity save.",
    scope: "world",
    config: true,
    default: false,
    type: Boolean
  });

  game.settings.register("mosh-greybearded-qol", "convertStress.noStressRelieve", {
    name: "No Stress Relieve",
    hint: "If enabled, stress will not be reset to minimum after stress conversion.",
    scope: "world",
    config: true,
    default: false,
    type: Boolean
  });

  game.settings.register("mosh-greybearded-qol", "convertStress.minStressConversion", {
    name: "Convert Minimum Stress",
    hint: "If enabled, stess conversion is capped at 0 instead of miminum stress.",
    scope: "world",
    config: true,
    default: false,
    type: Boolean
  });

  game.settings.register("mosh-greybearded-qol", "convertStress.formula", {
    name: "Stress Conversion Formula",
    hint: "Fallback dice formula used to convert stress (useful for Homebrew-Makros).",
    scope: "world",
    config: true,
    default: "1d5",
    type: String
  });

  // Config simple shore leave
  game.settings.register("mosh-greybearded-qol", "simpleShoreLeave.randomFlavor", {
    name: "Flovored shore leave activities",
    hint: "Enhance simple shore leave with random, flavored activities.",
    scope: "world",
    config: true,
    default: true,
    type: Boolean
  });

  game.settings.register("mosh-greybearded-qol", "simpleShoreLeave.disableFlavor", {
    name: "Disable shore leave flavor",
    hint: "Disable the randomized flavor of shore leave activities.",
    scope: "client",
    config: true,
    default: false,
    type: Boolean
  });
  
  // Config Shore Leave Tiers
  game.settings.register("mosh-greybearded-qol", "shoreLeaveTiers", {
    name: "Shore Leave Tier Definitions",
    scope: "world",
    config: false,
    type: Object,
    default: SHORE_LEAVE_TIERS
  });

  game.settings.registerMenu("mosh-greybearded-qol", "shoreLeaveEditor", {
    name: "Edit Shore Leave Tiers",
    label: "Edit Shore Leave...",
    hint: "Customize the tiers used in the simple shore leave system.",
    icon: "fas fa-edit",
    type: ShoreLeaveTierEditor,
    restricted: true
  });

  // ✅ Enable MoSh QoL Character Creator
  game.settings.register("mosh-greybearded-qol", "enableCharacterCreator", {
    name: "Enable QoL Character Creator",
    hint: "If enabled, replaces the old character creation macro with the new QoL version.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
  
  // ✅ Enable Ship Crits (default: false)
  game.settings.register("mosh-greybearded-qol", "enableShipCrits", {
    name: "Enable 0e Ship Crits",
    hint: "If enabled, ship crit button appears and the 0e crit logic activates.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });
});

Hooks.on("renderChatMessageHTML", (message, html /* HTMLElement */, data) => {
  const buttons = html.querySelectorAll(".greybeardqol .chat-action");
  for (const button of buttons) {
    button.addEventListener("click", async () => {
      const action = button.dataset.action;
      let args = [];
      if (button.dataset.args) {
        try { args = JSON.parse(button.dataset.args); } catch { args = []; }
      }
      if (!action) return;

      const actor = game.user.character;
      if (!actor) { ui.notifications.warn("No character assigned."); return; }

      switch (action) {
        case "convertStress":
          await game.moshGreybeardQol.convertStress(actor, ...args);
          break;
        case "simpleShoreLeave":
          await game.moshGreybeardQol.simpleShoreLeave(actor, ...args);
          break;
        case "triggerShipCrit":
          await game.moshGreybeardQol.triggerShipCrit(...args);
          break;
        default:
          ui.notifications.warn(`Unknown action: ${action}`);
      }
    }, { once: true });
  }
});

// Sheet Header Buttons
Hooks.on("renderActorSheet", (sheet, html) => {
  const actor = sheet.actor;
  const isGM = game.user.isGM;
  const isOwner = actor?.testUserPermission?.(game.user, "OWNER") ?? false;
  // Nur Sheet-Typ ermitteln und an die Helfer-Funktion durchreichen.
  const kind = getSheetKind(sheet);
  // upsert immer aufrufen; die Entscheidung über Sichtbarkeit/Buttons trifft später die Helfer-Funktion
  try {
    upsertToolband(sheet, html, { kind, isGM, isOwner });
  } catch (e) {
    console.error(e);
  }
});

// Prepare fesh characters for Character Creation
Hooks.on("createActor", async (actor, options, userId) => {
  // Nur für Charaktere
  if (actor.type !== "character") return;

  // Flag setzen
  await setReady(actor);
  console.log(`[MoSh QoL] setReady() gesetzt für neuen Charakter: ${actor.name}`);
});

// Toolband aufräumen
Hooks.on("closeActorSheet", (sheet) => {
  try { removeToolband(sheet); } catch (e) { console.error(e); }
});
