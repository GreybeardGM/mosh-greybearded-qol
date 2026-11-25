import { SETTING_MENU_KEYS } from "./constants.js";

// Keep these wire IDs stable: existing ChatMessage content and flavor store them.
export const CHAT_ACTION_APPLY_DAMAGE_SELECTED = "applyDamageSelected";
export const CHAT_ACTION_CONVERT_STRESS = "convertStress";
export const CHAT_ACTION_SIMPLE_SHORE_LEAVE = "simpleShoreLeave";
export const CHAT_ACTION_PAY_SHORE_LEAVE = "payShoreLeave";
export const CHAT_ACTION_TRIGGER_SHIP_CRIT = "triggerShipCrit";

export const FEATURE_ACTIONS = Object.freeze({
  credits: Object.freeze({
    action: "credits", settingKey: "credits", icon: "fa-solid fa-coins",
    label: "Credits", labelKey: "MoshQoL.Currency.App.Title"
  }),
  "apply-damage": Object.freeze({
    action: "apply-damage",
    settingKey: "applyDamage",
    icon: "fas fa-heart-broken",
    label: "Apply Damage",
    labelKey: "MoshQoL.Toolbar.Buttons.ApplyDamage"
  }),
  "armor-broken": Object.freeze({
    action: "armor-broken",
    settingKey: "armorBroken",
    icon: "fa-solid fa-shield-halved",
    label: "Armor Broken",
    labelKey: "MoshQoL.Toolbar.Buttons.ArmorBroken"
  }),
  "shore-leave": Object.freeze({
    action: "shore-leave",
    settingKey: "shoreLeave",
    icon: "fas fa-umbrella-beach",
    label: "Shore Leave",
    labelKey: "MoshQoL.Common.ShoreLeave"
  }),
  training: Object.freeze({
    action: "training",
    settingKey: "training",
    icon: "fa-solid fa-dumbbell",
    label: "Training",
    labelKey: "MoshQoL.Toolbar.Buttons.Training"
  }),
  "ship-crew-roster": Object.freeze({
    action: "ship-crew-roster",
    settingKey: "crewRoster",
    icon: "fa-solid fa-users",
    label: "Crew Roster",
    labelKey: "MoshQoL.Common.CrewRoster"
  }),
  "ship-crit": Object.freeze({
    action: "ship-crit",
    settingKey: "shipCrit",
    icon: "fas fa-explosion",
    label: "Critical Hit",
    labelKey: "MoshQoL.Toolbar.Buttons.ShipCrit"
  }),
  "toolband-config": Object.freeze({
    action: "toolband-config",
    icon: "fas fa-toolbox",
    label: "Toolband Configuration",
    labelKey: "MoshQoL.Settings.ToolbandConfig.Name"
  }),
  "training-config": Object.freeze({
    action: "training-config",
    icon: "fa-solid fa-dumbbell",
    label: "Training Configuration",
    labelKey: "MoshQoL.Settings.TrainingConfig.Name"
  })
});

const FEATURE_ACTION_ALIASES = Object.freeze({
  applyDamage: "apply-damage",
  [SETTING_MENU_KEYS.applyDamage]: "apply-damage",
  armorBroken: "armor-broken",
  shoreLeave: "shore-leave",
  [SETTING_MENU_KEYS.shoreLeave]: "shore-leave",
  crewRoster: "ship-crew-roster",
  shipCrit: "ship-crit",
  [SETTING_MENU_KEYS.toolband]: "toolband-config",
  [SETTING_MENU_KEYS.training]: "training-config"
});

function getFeatureActionMeta(action) {
  return FEATURE_ACTIONS[action] ?? FEATURE_ACTIONS[FEATURE_ACTION_ALIASES[action]] ?? null;
}

export function getFeatureIcon(action, fallback = "") {
  return getFeatureActionMeta(action)?.icon ?? fallback;
}
