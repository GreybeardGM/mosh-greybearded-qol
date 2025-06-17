import { convertStress } from "./convert-stress.js";

Hooks.once("ready", () => {
  game.moshGreybeardQol = game.moshGreybeardQol || {};
  game.moshGreybeardQol.convertStress = convertStress;
});
