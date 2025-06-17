import { convertStress } from "./scripts/convert-stress.js";

Hooks.once("ready", () => {
  // Global registry for use in macros
  game.moshGreybeardQol = game.moshGreybeardQol || {};
  game.moshGreybeardQol.convertStress = convertStress;
});
