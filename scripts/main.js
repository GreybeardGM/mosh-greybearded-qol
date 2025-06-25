import { defineStashSheet } from "./stash-sheet-class.js";
import { convertStress } from "./convert-stress.js";
import { ShoreLeaveTierEditor } from "./ui/edit-shore-leave-tiers.js";
import { simpleShoreLeave } from "./simple-shore-leave.js";
import { SHORE_LEAVE_TIERS } from "./config/default-shore-leave-tiers.js";
import { triggerShipCrit } from "./ship-crits-0e.js";

// Register all the stuff
Hooks.once("ready", () => {
  // Global registry for use in macros
  game.moshGreybeardQol = game.moshGreybeardQol || {};
  game.moshGreybeardQol.convertStress = convertStress;
  game.moshGreybeardQol.simpleShoreLeave = simpleShoreLeave;
  game.moshGreybeardQol.triggerShipCrit = triggerShipCrit;

  // Register Stash Sheet
  const BaseSheet = CONFIG.Actor.sheetClasses.character["mosh.MothershipActorSheet"].cls;
  const StashSheet = defineStashSheet(BaseSheet);

  Actors.registerSheet("dwextrasheets", StashSheet, {
    types: ["character"],
    label: "Stash Sheet",
    makeDefault: false // oder true, um direkt zu testen
  });
 
  // Debug Check
  console.log("✅ MoSh Greybearded QoL loaded");
});

// Settings
Hooks.once("init", () => {
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
    hint: "The default dice formula used to convert stress (e.g., '1d5').",
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
  
  if (actor?.type === "ship") {
    const titleElem = html[0]?.querySelector(".window-header .window-title");
    if (!titleElem || titleElem.parentElement.querySelector(".ship-crit")) return;

    const button = document.createElement("a");
    button.classList.add("header-button", "ship-crit");
    button.innerHTML = `<i class="fas fa-explosion"></i> Crit`;

    Object.assign(button.style, {
      cursor: "pointer",
      padding: "0 6px",
      color: "#f50",
      fontWeight: "bold",
      textShadow: "0 0 2px rgba(255,85,0,0.5)"
    });

    button.addEventListener("click", () => {
      game.moshGreybeardQol.triggerShipCrit(null, actor.uuid);
    });

    titleElem.insertAdjacentElement("afterend", button);
  }

  if (actor?.type === "character") {
    const titleElem = html[0]?.querySelector(".window-header .window-title");
    if (!titleElem || titleElem.parentElement.querySelector(".simple-shoreleave")) return;

    const button = document.createElement("a");
    button.classList.add("header-button", "simple-shoreleave");
    button.innerHTML = `<i class="fas fa-umbrella-beach"></i> Shore Leave`;

    Object.assign(button.style, {
      cursor: "pointer",
      padding: "0 6px",
      color: "#3cf",
      fontWeight: "bold",
      textShadow: "0 0 2px rgba(0,255,255,0.5)"
    });

    button.addEventListener("click", () => {
      game.moshGreybeardQol.simpleShoreLeave(actor);
    });

    titleElem.insertAdjacentElement("afterend", button);
  }
});
