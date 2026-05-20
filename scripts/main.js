import { QoLContractorSheet } from "./sheets/contractor-sheet-class.js";
import { defineStashSheet } from "./sheets/stash-sheet-class.js";
import { convertStress } from "./shore-leave/convert-stress.js";
import {
  SHORE_LEAVE_CONFIG_SETTING,
  ShoreLeaveConfigApp,
  getDefaultShoreLeaveConfig
} from "./settings/shore-leave-config.js";
import { ToolbandConfigApp, getDefaultToolbandConfig } from "./settings/toolband-config.js";
import {
  APPLY_DAMAGE_CONFIG_SETTING,
  ApplyDamageConfigApp,
  getDefaultApplyDamageConfig
} from "./settings/apply-damage-config.js";
import {
  LEGACY_SHIP_CRITS_SETTING,
  SHIP_CRITS_MIGRATION_SETTING,
  migrateLegacyShipCritToolbandConfig
} from "./migration/toolband.js";
import {
  SHORE_LEAVE_CONFIG_MIGRATION_SETTING,
  migrateLegacyShoreLeaveConfig
} from "./migration/shore-leave.js";
import { SimpleShoreLeave } from "./shore-leave/simple-shore-leave.js";
import { SHORE_LEAVE_TIERS } from "./codex/default-shore-leave-tiers.js";
import { triggerShipCrit } from "./ship-crits-0e.js";
import { upsertToolband, removeToolband } from "./toolband.js";
import { applyDamage, promptDamageInput } from "./apply-damage/apply-damage.js";
import { insertApplyDamageChatButtons } from "./apply-damage/chat-buttons.js";
import { startCharacterCreation } from "./character-creator/character-creator.js";
import { registerDiceTerms } from "./dice.js";
import { capitalize, normalizeNumber, stripHtml } from "./utils/normalization.js";
import { setReady } from "./character-creator/progress.js";
import "./patches/creature-skillfix.js";

// Needs to be here to check for
let StashSheet;

/** Resolve a stable sheet "kind" identifier for toolbar behavior. */
function getSheetKind(sheet) {
  const actor = sheet?.actor;
  // Check explicit sheet classes first.
  if (sheet instanceof QoLContractorSheet) return "contractor";
  if (StashSheet && sheet instanceof StashSheet) return "stash";
  // Fallback: infer from actor type.
  if (actor?.type === "ship") return "ship";
  if (actor?.type === "character") return "character";
  if (actor?.type === "creature") return "creature";
  return "unknown";
}


// Register all the stuff
Hooks.once("ready", () => {
  
  Handlebars.registerHelper("eq", (a, b) => a === b);  
  Handlebars.registerHelper("array", (...args) => args.slice(0, -1));
  Handlebars.registerHelper("capitalize", str => capitalize(str));
  Handlebars.registerHelper("concat", (...args) => args.slice(0, -1).join(""));
  Handlebars.registerHelper("includes", function (collection, value) {
    if (Array.isArray(collection)) return collection.includes(value);
    if (collection instanceof Set) return collection.has(value);
    return false;
  });
  Handlebars.registerHelper("stripHtml", (text) => stripHtml(text));
  
  // Global registry for use in macros
  game.moshGreybeardQol = game.moshGreybeardQol || {};
  game.moshGreybeardQol.convertStress = convertStress;
  game.moshGreybeardQol.SimpleShoreLeave = SimpleShoreLeave;
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
    label: "MoshQoL.Sheets.Stash",
    makeDefault: false
  });

  ActorsCollection.registerSheet("mosh-greybearded-qol", QoLContractorSheet, {
    types: ["creature"],
    label: "MoshQoL.Sheets.Contractor",
    makeDefault: false
  });

  // Armor Broken Status Effect
  const customStatus = {
    id: "qol-broken-armor",
    name: "MoshQoL.Status.BrokenArmor",
    img: "modules/mosh-greybearded-qol/assets/icons/status/armor-broken.svg"
  };
  if (!CONFIG.statusEffects.some(e => e.id === customStatus.id)) {
    CONFIG.statusEffects.push(customStatus);
  }
  

});

// Settings
Hooks.once("init", () => {
  registerDiceTerms();

  // Theme Colors
  game.settings.register("mosh-greybearded-qol", "themeColor", {
    name: "MoshQoL.Settings.ThemeColor.Name",
    hint: "MoshQoL.Settings.ThemeColor.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "#f50"
  });

  game.settings.register("mosh-greybearded-qol", "themeColorOverride", {
    name: "MoshQoL.Settings.ThemeColorOverride.Name",
    hint: "MoshQoL.Settings.ThemeColorOverride.Hint",
    scope: "client",
    config: true,
    type: String,
    default: ""
  });

  // Config Stress Conversion
  game.settings.register("mosh-greybearded-qol", "convertStress.noSanitySave", {
    name: "MoshQoL.Settings.ConvertStress.NoSanitySave.Name",
    hint: "MoshQoL.Settings.ConvertStress.NoSanitySave.Hint",
    scope: "world",
    config: false,
    default: false,
    type: Boolean
  });

  game.settings.register("mosh-greybearded-qol", "convertStress.noStressRelieve", {
    name: "MoshQoL.Settings.ConvertStress.NoStressRelieve.Name",
    hint: "MoshQoL.Settings.ConvertStress.NoStressRelieve.Hint",
    scope: "world",
    config: false,
    default: false,
    type: Boolean
  });

  game.settings.register("mosh-greybearded-qol", "convertStress.minStressConversion", {
    name: "MoshQoL.Settings.ConvertStress.MinStressConversion.Name",
    hint: "MoshQoL.Settings.ConvertStress.MinStressConversion.Hint",
    scope: "world",
    config: false,
    default: false,
    type: Boolean
  });

  game.settings.register("mosh-greybearded-qol", "convertStress.formula", {
    name: "MoshQoL.Settings.ConvertStress.Formula.Name",
    hint: "MoshQoL.Settings.ConvertStress.Formula.Hint",
    scope: "world",
    config: false,
    default: "1d5",
    type: String
  });

  // Config simple shore leave
  game.settings.register("mosh-greybearded-qol", "simpleShoreLeave.randomFlavor", {
    name: "MoshQoL.Settings.SimpleShoreLeave.RandomFlavor.Name",
    hint: "MoshQoL.Settings.SimpleShoreLeave.RandomFlavor.Hint",
    scope: "world",
    config: false,
    default: true,
    type: Boolean
  });

  game.settings.register("mosh-greybearded-qol", "simpleShoreLeave.disableFlavor", {
    name: "MoshQoL.Settings.SimpleShoreLeave.DisableFlavor.Name",
    hint: "MoshQoL.Settings.SimpleShoreLeave.DisableFlavor.Hint",
    scope: "client",
    config: true,
    default: false,
    type: Boolean
  });
  

  game.settings.register("mosh-greybearded-qol", SHORE_LEAVE_CONFIG_SETTING, {
    name: "MoshQoL.Common.ShoreLeaveConfiguration",
    scope: "world",
    config: false,
    type: Object,
    default: getDefaultShoreLeaveConfig()
  });

  // Config Shore Leave Tiers
  game.settings.register("mosh-greybearded-qol", "shoreLeaveTiers", {
    name: "MoshQoL.Settings.ShoreLeaveTiers.Name",
    scope: "world",
    config: false,
    type: Object,
    default: SHORE_LEAVE_TIERS
  });

  game.settings.registerMenu("mosh-greybearded-qol", "shoreLeaveEditor", {
    name: "MoshQoL.Settings.ShoreLeaveEditor.Name",
    label: "MoshQoL.Settings.ShoreLeaveEditor.Label",
    hint: "MoshQoL.Settings.ShoreLeaveEditor.Hint",
    icon: "fas fa-edit",
    type: ShoreLeaveConfigApp,
    restricted: true
  });

  // Configure Toolband buttons.
  game.settings.register("mosh-greybearded-qol", "toolbandConfig", {
    name: "MoshQoL.Settings.ToolbandConfig.SettingName",
    scope: "world",
    config: false,
    type: Object,
    default: getDefaultToolbandConfig()
  });

  game.settings.registerMenu("mosh-greybearded-qol", "toolbandConfigMenu", {
    name: "MoshQoL.Settings.ToolbandConfig.Name",
    label: "MoshQoL.Settings.ToolbandConfig.Label",
    hint: "MoshQoL.Settings.ToolbandConfig.Hint",
    icon: "fas fa-toolbox",
    type: ToolbandConfigApp,
    restricted: true
  });

  // Configure Apply Damage behavior.
  game.settings.register("mosh-greybearded-qol", APPLY_DAMAGE_CONFIG_SETTING, {
    name: "MoshQoL.Settings.ApplyDamageConfig.SettingName",
    scope: "world",
    config: false,
    type: Object,
    default: getDefaultApplyDamageConfig()
  });

  game.settings.registerMenu("mosh-greybearded-qol", "applyDamageConfigMenu", {
    name: "MoshQoL.Settings.ApplyDamageConfig.Name",
    label: "MoshQoL.Settings.ApplyDamageConfig.Label",
    hint: "MoshQoL.Settings.ApplyDamageConfig.Hint",
    icon: "fas fa-heart-broken",
    type: ApplyDamageConfigApp,
    restricted: true
  });

  // Enable MoSh QoL Character Creator.
  game.settings.register("mosh-greybearded-qol", "enableCharacterCreator", {
    name: "MoshQoL.Settings.EnableCharacterCreator.Name",
    hint: "MoshQoL.Settings.EnableCharacterCreator.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
  
  // Legacy Ship Crits setting. Hidden now; migrated into the Toolband Config on ready.
  game.settings.register("mosh-greybearded-qol", LEGACY_SHIP_CRITS_SETTING, {
    name: "MoshQoL.Settings.EnableShipCrits.Name",
    hint: "MoshQoL.Settings.EnableShipCrits.Hint",
    scope: "world",
    config: false,
    type: Boolean,
    default: false
  });

  game.settings.register("mosh-greybearded-qol", SHIP_CRITS_MIGRATION_SETTING, {
    scope: "world",
    config: false,
    type: Boolean,
    default: false
  });

  game.settings.register("mosh-greybearded-qol", SHORE_LEAVE_CONFIG_MIGRATION_SETTING, {
    scope: "world",
    config: false,
    type: Boolean,
    default: false
  });
});

Hooks.once("ready", () => {
  migrateLegacyShipCritToolbandConfig().catch((error) => {
    console.error("[MoSh QoL] Failed to migrate legacy ship crit setting", error);
  });

  migrateLegacyShoreLeaveConfig().catch((error) => {
    console.error("[MoSh QoL] Failed to migrate legacy shore leave settings", error);
  });
});


async function applyDamageToSelectedTokens(damageInput, antiArmor, woundType = null, woundRollModifier = null) {
  const selected = canvas?.tokens?.controlled ?? [];
  if (!selected.length) {
    ui.notifications.warn(game.i18n.localize("MoshQoL.Damage.NoTokensSelected"));
    return;
  }

  const damage = normalizeNumber(damageInput, { fallback: null, min: 1 });
  if (damage === null) {
    ui.notifications.warn(game.i18n.localize("MoshQoL.Damage.PositiveValueRequired"));
    return;
  }

  let applied = 0;
  for (const token of selected) {
    const actorLike = token?.actor ?? token;
    if (!actorLike) continue;
    try {
      const didApply = await game.moshGreybeardQol.applyDamage(actorLike, damage, antiArmor, woundType, woundRollModifier);
      if (didApply !== false) applied++;
    } catch (err) {
      console.error("applyDamage failed for", token, err);
    }
  }

  ui.notifications.info(game.i18n.format("MoshQoL.Damage.AppliedToTokens", {
    applied,
    total: selected.length,
    tokens: game.i18n.localize(selected.length === 1 ? "MoshQoL.Damage.TokenSingular" : "MoshQoL.Damage.TokenPlural")
  }));
}

function getChatActionArgs(button) {
  if (!button.dataset.args) return [];

  try {
    return JSON.parse(button.dataset.args);
  } catch (error) {
    console.warn("[MoSh QoL] Failed to parse chat action args", error);
    return [];
  }
}

function getRequiredChatActionActor() {
  const actor = game.user.character;
  if (!actor) {
    ui.notifications.warn(game.i18n.localize("MoshQoL.Errors.NoCharacterAssigned"));
  }
  return actor;
}

Hooks.on("renderChatMessageHTML", (message, html /* HTMLElement */, data) => {
  insertApplyDamageChatButtons(message, html);

  if (html.dataset.moshQolChatActionsBound) return;
  html.dataset.moshQolChatActionsBound = "true";

  html.addEventListener("click", async (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest(".greybeardqol .chat-action");
    if (!button || !html.contains(button)) return;

    event.preventDefault();

    const action = button.dataset.action;
    if (!action) return;

    const args = getChatActionArgs(button);

    switch (action) {
      case "applyDamageSelected": {
        await applyDamageToSelectedTokens(args[0], args[1] === true, args[2] ?? null, args[3] ?? null);
        break;
      }
      case "convertStress": {
        const actor = getRequiredChatActionActor();
        if (!actor) return;
        await game.moshGreybeardQol.convertStress(actor, ...args);
        break;
      }
      case "simpleShoreLeave": {
        const actor = getRequiredChatActionActor();
        if (!actor) return;
        await game.moshGreybeardQol.SimpleShoreLeave.wait({ actor, randomFlavor: args[0] });
        break;
      }
      case "triggerShipCrit":
        await game.moshGreybeardQol.triggerShipCrit(...args);
        break;
      default:
        ui.notifications.warn(game.i18n.format("MoshQoL.Errors.UnknownAction", { action }));
    }
  });
});

// Sheet Header Buttons
Hooks.on("renderActorSheet", (sheet, html) => {
  const actor = sheet.actor;
  const isGM = game.user.isGM;
  const isOwner = actor?.testUserPermission?.(game.user, "OWNER") ?? false;
  if ( !isGM && !isOwner ) return;
  // Resolve the sheet kind and pass it to the helper.
  const kind = getSheetKind(sheet);
  // Always call upsert; helper logic decides visibility and available buttons.
  try {
    upsertToolband(sheet, html, { kind, isGM });
  } catch (e) {
    console.error(e);
  }
});

// Prepare fresh characters for Character Creation
Hooks.on("createActor", async (actor, options, userId) => {
  // Character actors only.
  if (actor.type !== "character") return;

  // Set the ready flag.
  await setReady(actor);
});

// Clean up toolband.
Hooks.on("closeActorSheet", (sheet) => {
  try { removeToolband(sheet); } catch (e) { console.error(e); }
});

/**
 * Robustly insert the apply-damage tool into token controls.
 * Foundry V13 (per module.json minimum/verified) uses `controls` and `tools` as Record/Object values.
 * Array forms remain as defensive compatibility for unusual/custom hook payloads.
 */
function insertApplyDamageTool(tokenControls, toolDef) {
  if (!tokenControls) return;

  if (Array.isArray(tokenControls.tools)) {
    tokenControls.tools.push(toolDef);
    return;
  }

  tokenControls.tools = tokenControls.tools ?? {};
  const order = Object.keys(tokenControls.tools).length;
  tokenControls.tools.applyDamage = { ...toolDef, order };
}

// register token damage tool
Hooks.on("getSceneControlButtons", (controls) => {
  // Normalize: get the Token controls whether `controls` is Array or Object
  const tokenControls = Array.isArray(controls)
    ? controls.find(c => c?.name === "token")
    : (controls?.token ?? controls?.tokens ?? null);
  if (!tokenControls) return;

  const toolDef = {
    name: "applyDamage",
    title: game.i18n.localize("MoshQoL.Damage.ApplyDamageToSelectedTokens"),
    icon: "fa-solid fa-heart-broken",
    visible: game.user.isGM,
    button: true,
    onClick: async () => {
      if (!game.user?.isGM) return;

      const selected = canvas?.tokens?.controlled ?? [];
      if (!selected.length) {
        ui.notifications.warn(game.i18n.localize("MoshQoL.Damage.NoTokensSelected"));
        return;
      }

      // Ask once, apply to all
      const data = await promptDamageInput({
        title: game.i18n.localize("MoshQoL.Damage.ApplyDamageToSelectedTokens"),
        message: game.i18n.format("MoshQoL.Damage.EnterAmountForTokens", {
          count: selected.length,
          tokens: game.i18n.localize(selected.length === 1 ? "MoshQoL.Damage.TokenSingular" : "MoshQoL.Damage.TokenPlural")
        }),
        cancel: { label: game.i18n.localize("MoshQoL.Common.Cancel"), icon: "fa-solid fa-xmark" }
      });

      if (!data) return;
      await applyDamageToSelectedTokens(data.damage, data.antiArmor);
    }
  };

  insertApplyDamageTool(tokenControls, toolDef);
});
