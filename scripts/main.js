import { defineStashSheet } from "./stash-sheet-class.js";
import { convertStress } from "./convert-stress.js";
import { ShoreLeaveTierEditor } from "./ui/edit-shore-leave-tiers.js";
import { simpleShoreLeave } from "./simple-shore-leave.js";
import { SHORE_LEAVE_TIERS } from "./config/default-shore-leave-tiers.js";
import { ShoreLeaveGMDialog } from "./shore-leave-gm-dialog.js";

Hooks.once("ready", () => {
  // Global registry for use in macros
  game.moshGreybeardQol = game.moshGreybeardQol || {};
  game.moshGreybeardQol.convertStress = convertStress;
  game.moshGreybeardQol.simpleShoreLeave = simpleShoreLeave;
  game.moshGreybeardQol.ShoreLeaveGMDialog = ShoreLeaveGMDialog;

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
  // Register handlebars helper
  Handlebars.registerHelper("array", (...args) => {
    // Remove last item which is Handlebars options object
    return args.slice(0, -1);
  });
  
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
