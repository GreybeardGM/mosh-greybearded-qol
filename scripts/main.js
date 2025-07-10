import { defineStashSheet } from "./stash-sheet-class.js";
import { convertStress } from "./convert-stress.js";
import { ShoreLeaveTierEditor } from "./ui/edit-shore-leave-tiers.js";
import { simpleShoreLeave } from "./simple-shore-leave.js";
import { SHORE_LEAVE_TIERS } from "./config/default-shore-leave-tiers.js";
import { triggerShipCrit } from "./ship-crits-0e.js";
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

/**
 * Fügt einen Button in die Actor Sheet Header-Leiste ein.
 * @param {HTMLElement} titleElem - Der DOM-Knoten mit der Fensterüberschrift
 * @param {string} className - Zusätzliche Klasse für den Button
 * @param {string} iconClass - FontAwesome-Icon-Klasse (ohne "fas")
 * @param {string} label - Der Text des Buttons
 * @param {string} color - Die Hauptfarbe für Text und Schatten
 * @param {Function} callback - Eventhandler bei Klick
 */
function insertHeaderButton(titleElem, className, iconClass, label, color, callback) {
  const button = document.createElement("a");
  button.classList.add("header-button", className);
  button.innerHTML = `<i class="fas ${iconClass}"></i> ${label}`;

  Object.assign(button.style, {
    cursor: "pointer",
    padding: "0 6px",
    color,
    fontWeight: "bold",
    textShadow: `0 0 2px ${color}88`
  });

  button.addEventListener("click", callback);
  titleElem.insertAdjacentElement("afterend", button);
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

  // Register Stash Sheet
  const BaseSheet = CONFIG.Actor.sheetClasses.character["mosh.MothershipActorSheet"].cls;
  StashSheet = defineStashSheet(BaseSheet);

  Actors.registerSheet("dwextrasheets", StashSheet, {
    types: ["character"],
    label: "Stash Sheet",
    makeDefault: false
  });
  
  // Debug Check
  console.log("✅ MoSh Greybearded QoL loaded");  
});

Hooks.on("getActorDirectoryEntryContext", (html, options) => {
  const enabled = game.settings.get("mosh-greybearded-qol", "enableCharacterCreator");
  if (!enabled) return;

  options.push(
    {
      name: "Reset Character Creator",
      icon: '<i class="fas fa-undo"></i>',
      condition: li => {
        const actor = game.actors.get(li.data("documentId"));
        return game.user.isGM && actor?.type === "character";
      },
      callback: li => {
        const actor = game.actors.get(li.data("documentId"));
        if (!actor) return;
        reset(actor);
        ui.notifications.info(`Character Creator progress reset for: ${actor.name}`);
      }
    },
    {
      name: "Mark Ready",
      icon: '<i class="fas fa-check-circle"></i>',
      condition: li => {
        const actor = game.actors.get(li.data("documentId"));
        return game.user.isGM && actor?.type === "character" && !checkCompleted(actor) && !checkReady(actor);
      },
      callback: li => {
        const actor = game.actors.get(li.data("documentId"));
        if (!actor) return;
        setReady(actor);
        ui.notifications.info(`Character marked ready: ${actor.name}`);
      }
    },
    {
      name: "Mark Complete",
      icon: '<i class="fas fa-flag-checkered"></i>',
      condition: li => {
        const actor = game.actors.get(li.data("documentId"));
        return game.user.isGM && actor?.type === "character" && !checkCompleted(actor);
      },
      callback: li => {
        const actor = game.actors.get(li.data("documentId"));
        if (!actor) return;
        setCompleted(actor);
        ui.notifications.info(`Character marked completed: ${actor.name}`);
      }
    }
  );
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

// Chat actions
Hooks.on("renderChatMessage", (message, html, data) => {
  html.find(".greybeardqol .chat-action").each(function () {
    const button = this;
    button.addEventListener("click", async () => {
      const action = button.dataset.action;
      const args = button.dataset.args ? JSON.parse(button.dataset.args) : [];

      if (!action) return;

      const actor = game.user.character;
      if (!actor) return ui.notifications.warn("No character assigned.");

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
        // Add more cases as needed
        default:
          ui.notifications.warn(`Unknown action: ${action}`);
      }
    });
  });
});

// Sheet Header Buttons
Hooks.on("renderActorSheet", (sheet, html) => {
  const actor = sheet.actor;
  // Cancel if not Owner
  const isGM = game.user.isGM;
  const isOwner = actor.testUserPermission(game.user, "OWNER");
  if (!(isGM || isOwner)) return;
  // Cancel if Stash
  if (sheet instanceof StashSheet) return;

  // 🚢 0e Ship Crits
  if (
    actor?.type === "ship" &&
    game.settings.get("mosh-greybearded-qol", "enableShipCrits")
  ) {
    const titleElem = html[0]?.querySelector(".window-header .window-title");
    if (!titleElem || titleElem.parentElement.querySelector(".ship-crit")) return;
    insertHeaderButton(titleElem, "ship-crit", "fa-explosion", "Crit", "#f50", () => game.moshGreybeardQol.triggerShipCrit(null, actor.uuid));
  }

  if (actor?.type === "character") {
    const titleElem = html[0]?.querySelector(".window-header .window-title");
    if (!titleElem) return;
  
    // Entferne ShoreLeave Button, falls vorhanden
    const existingShoreLeave = titleElem.parentElement.querySelector(".simple-shoreleave");
    if (existingShoreLeave) existingShoreLeave.remove();
  
    const isCreatorEnabled = game.settings.get("mosh-greybearded-qol", "enableCharacterCreator");
    const isReady = checkReady(actor) && !checkCompleted(actor);
  
    if (isCreatorEnabled && isReady) {
      // Ersetze durch Character-Reset-Button
      insertHeaderButton(titleElem, "create-character", "fa-dice-d20", "Roll Character", "#5f0", () => game.moshGreybeardQol.startCharacterCreation(actor));
    } else {
      // Standard ShoreLeave-Button einfügen
      insertHeaderButton(titleElem, "simple-shoreleave", "fa-umbrella-beach", "Shore Leave", "#3cf", () => game.moshGreybeardQol.simpleShoreLeave(actor));
    }

    if (!isCreatorEnabled) return;
  
    // Button finden und verstecken
    const oldCreatorButton = html[0].querySelector(".configure-actor");
    if (oldCreatorButton) {
      oldCreatorButton.style.display = "none";
      console.log("[MoSh QoL] Configure-Button hidden");
    }
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

/*
// Remove Default Character Creator
Hooks.once("ready", () => {
  const actor = game.actors.find(a => a.type === "character");
  if (!actor) return console.warn("MoSh QoL: No character found.");

  const sheetClass = actor.sheet.constructor;

  if (!sheetClass.prototype._getHeaderButtons) {
    console.warn(`MoSh QoL: ${sheetClass.name} has no _getHeaderButtons method.`);
    return;
  }

  const original = sheetClass.prototype._getHeaderButtons;

  sheetClass.prototype._getHeaderButtons = function (...args) {
    const buttons = original.call(this, ...args);
    return buttons.filter(
      (b) => !(b.class === "configure-actor" && b.icon === "fas fa-cogs")
    );
  };

  console.log(`[MoSh QoL] _getHeaderButtons removed from ${sheetClass.name}.`);
});
*/
