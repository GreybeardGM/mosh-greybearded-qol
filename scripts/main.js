import { convertStress } from "./shore-leave/convert-stress.js";
import { DEFAULT_THEME_COLOR } from "./codex/constants.js";
import { registerSettings } from "./settings/register-settings.js";
import { runReadyMigrations } from "./register/migrations.js";
import { SimpleShoreLeave } from "./shore-leave/simple-shore-leave.js";
import { triggerShipCrit } from "./ship-crits-0e.js";
import { applyDamage } from "./apply-damage/apply-damage.js";
import { registerChatActions } from "./chat-actions.js";
import { registerApplyDamageSceneControl } from "./apply-damage/scene-control.js";
import { startCharacterCreation } from "./character-creator/character-creator.js";
import { registerDiceTerms } from "./dice.js";
import { registerModuleApi } from "./register/api.js";
import { registerActorHooks } from "./register/actor-hooks.js";
import { registerHandlebarsHelpers } from "./register/handlebars-helpers.js";
import { registerActorSheets } from "./register/sheets.js";
import { registerStatusEffects } from "./register/status-effects.js";
import "./patches/creature-skillfix.js";

Hooks.once("init", () => {
  document.documentElement.style.setProperty("--mosh-qol-default-theme-color", DEFAULT_THEME_COLOR);
  registerDiceTerms();
  registerSettings();
  registerHandlebarsHelpers();
  registerApplyDamageSceneControl();
  registerActorHooks();
});

Hooks.once("ready", () => {
  registerModuleApi({
    convertStress,
    SimpleShoreLeave,
    triggerShipCrit,
    startCharacterCreation,
    applyDamage
  });

  registerChatActions();
  registerActorSheets();
  registerStatusEffects();
  runReadyMigrations();
});
