export const FEATURE_ACTIONS = Object.freeze({
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
  })
});

const FEATURE_ACTION_ALIASES = Object.freeze({
  applyDamage: "apply-damage",
  applyDamageConfigMenu: "apply-damage",
  armorBroken: "armor-broken",
  shoreLeave: "shore-leave",
  shoreLeaveEditor: "shore-leave",
  crewRoster: "ship-crew-roster",
  shipCrit: "ship-crit",
  toolbandConfigMenu: "toolband-config"
});

function getFeatureActionMeta(action) {
  return FEATURE_ACTIONS[action] ?? FEATURE_ACTIONS[FEATURE_ACTION_ALIASES[action]] ?? null;
}

export function getFeatureIcon(action, fallback = "") {
  return getFeatureActionMeta(action)?.icon ?? fallback;
}
