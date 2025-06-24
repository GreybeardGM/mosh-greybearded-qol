import { defineStashSheet } from "./stash-sheet-class.js";
import { convertStress } from "./convert-stress.js";
import { ShoreLeaveTierEditor } from "./ui/edit-shore-leave-tiers.js";
import { simpleShoreLeave } from "./simple-shore-leave.js";
import { SHORE_LEAVE_TIERS } from "./config/default-shore-leave-tiers.js";

Hooks.once("ready", () => {
  // Global registry for use in macros
  game.moshGreybeardQol = game.moshGreybeardQol || {};
  game.moshGreybeardQol.convertStress = convertStress;
  game.moshGreybeardQol.simpleShoreLeave = simpleShoreLeave;
  
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
  game.settings.register("mosh-greybearded-qol", "convertStress.useSanitySave", {
    name: "Use Sanity Save",
    hint: "If enabled, the user must pass a sanity save before converting stress.",
    scope: "world",
    config: true,
    default: true,
    type: Boolean
  });

  game.settings.register("mosh-greybearded-qol", "convertStress.relieveStress", {
    name: "Reset Stress to Minimum",
    hint: "If enabled, stress is always reduced to the actor's minimum after conversion.",
    scope: "world",
    config: true,
    default: true,
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

// Chat button: Participate on shore leave
Hooks.on("renderChatMessage", (message, html, data) => {
  html.find(".shoreleave-convert").on("click", async function () {
    const formula = $(this).data("formula");
    const actor = game.user.character;
    if (!actor) return ui.notifications.warn("No default character assigned.");
    await game.moshGreybeardQol.convertStress(actor, formula);
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
        // Add more cases as needed
        default:
          ui.notifications.warn(`Unknown action: ${action}`);
      }
    });
  });
});

