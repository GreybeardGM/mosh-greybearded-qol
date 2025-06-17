import { convertStress } from "./convert-stress.js";

Hooks.once("ready", () => {
  // Global registry for use in macros
  game.moshGreybeardQol = game.moshGreybeardQol || {};
  game.moshGreybeardQol.convertStress = convertStress;

  // Debug Check
  console.log("✅ MoSh Greybearded QoL loaded");
  console.log("✅ convertStress function:", convertStress);
});

// Settings
Hooks.once("init", () => {
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
});
