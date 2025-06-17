import { convertStress } from "./convert-stress.js";

Hooks.once("ready", () => {
  // Global registry for use in macros
  game.moshGreybeardQol = game.moshGreybeardQol || {};
  game.moshGreybeardQol.convertStress = convertStress;

  // Debug Check
  console.log("✅ MoSh Greybearded QoL loaded");
  console.log("✅ convertStress function:", convertStress);
});
